// src/app/driver/SingleStopScreen.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import tw from 'twrnc';
import MapboxGL from '@rnmapbox/maps';
import {
  Navigation as NavIcon,
  Phone,
  MapPin,
  CheckCircle,
  Info as InfoIcon,
  ArrowLeft,
  Image as ImageIcon,
  Camera,
  X,
  Trash2,
} from 'react-native-feather';
import Geolocation from '@react-native-community/geolocation';
import { useTheme } from '../../shared/hooks/useTheme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  updateStopStatus,
  createStopsPhotos,
  getStopById,
  updateStopPayment,
} from '../../shared/lib/StopsHelpers';
import {
  takePhotoWithCamera,
  pickImageFromGallery,
  uploadImage,
} from '../../shared/lib/ImageHelpers';
import { useSession } from '../../state/useSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessAdmin } from '../../shared/lib/BusinessHelpers';

const DevMode = true;

const MAPBOX_TOKEN =
  'pk.eyJ1IjoibW92YWwiLCJhIjoiY21jZTJ1cnJrMDc3dTJrcHBwZzMyd2dhdSJ9.DFSiGfHa19L8vMK7muIr8A';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

const STOP_STATUS_META: Record<string, { label: string; bg: string }> = {
  scheduled: { label: 'Scheduled', bg: '#6B7280' },
  en_route: { label: 'En Route', bg: '#3B82F6' },
  arrived: { label: 'Arrived', bg: '#F59E0B' },
  completed: { label: 'Completed', bg: '#10B981' },
};

type LatLng = { latitude: number; longitude: number };

type Payment = {
  id: number;
  method: string | null;
  status: string | null;
  currency?: string | null;
  amount_due?: number | null;
  amount_authorized?: number | null;
  amount_captured?: number | null;
  amount_refunded?: number | null;
  direction?: 'collect' | 'pay' | null;
  description?: string | null;
  receipt_url?: string | null;
};

type Requirements = {
  id_required?: boolean;
  access_info?: string | null;
  access_code?: string | null;
  two_person?: boolean;
  lift_gate_required?: boolean;
  signature?: boolean;
  contact_before?: boolean;
  contactless?: boolean;
  give_invoice?: boolean;
  temp_control?: boolean;
  dock_appointment?: boolean;
  require_photo_invoice?: boolean;
  require_photo_products?: boolean;
  print_name?: string | boolean;
  notes?: string | null;
};

type Photo = {
  id: number;
  photo_url: string;
  width?: number;
  height?: number;
  photo_category?: 'invoice' | 'products' | 'other' | null;
  storage_path?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
};

type Stop = {
  id: number;
  status: string;
  business_name: string;
  stop_type?: string | null;
  sequence?: number | null;
  route_id?: number | null;

  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  time_window_start?: string | null;
  time_window_end?: string | null;

  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;

  eta?: string | null;

  payments?: Payment | null;
  requirements?: Requirements | null;

  photos?: Photo[] | null;
  proof?: any;
  details?: any;
};

type Props = {
  route: { params: { stop: Stop } };
  navigation: any;
  onArrivedAPI?: (stopId: number, arrivedAtISO: string) => Promise<void>;
};

const TWO_MILES = 2;
const DEFAULT_AVG_MPH = 25;

/** New: image item shape for the two buckets */
type imageItem = {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number;
};

type ActionState = {
  signatureImage?: imageItem | null;
  printedName?: string;
  gaveInvoiceConfirmed?: boolean;
  idCheckedConfirmed?: boolean;
  calledContactConfirmed?: boolean;
  contactlessDropConfirmed?: boolean;
  dockApptConfirmed?: boolean;
  tempReadingF?: number | null;
  accessCodeEntered?: string;
};

export default function SingleStopScreen({ route, onArrivedAPI }: Props) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { profile, business } = useSession();
  const [stop, setStop] = useState<Stop>(route?.params?.stop);

  // Location & routing
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [routeShape, setRouteShape] = useState<any | null>(null);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [routeDurationS, setRouteDurationS] = useState<number | null>(null);
  const lastOriginRef = useRef<LatLng | null>(null);
  const [devBypassRadius, setDevBypassRadius] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Picker modal state (reused for both buckets)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeBucket, setActiveBucket] = useState<'invoice' | 'other' | null>(
    null,
  );

  const [signatureCollected, setSignatureCollected] = useState(false);

  // ✅ New: two image buckets
  const [invoiceImages, setInvoiceImages] = useState<imageItem[]>([]);
  const [otherImages, setOtherImages] = useState<imageItem[]>([]);
  const [adminPhotos, setAdminPhotos] = useState<imageItem[]>([]);
  // ✅ New: actionable requirement inputs
  const [actions, setActions] = useState<ActionState>({});

  // Payment form
  const [paymentForm, setPaymentForm] = useState<{
    direction: 'collect' | 'pay' | '';
    method: 'cash' | 'card' | 'check' | 'transfer' | 'zelle' | 'other' | '';
    status: 'collected' | 'pending' | 'failed' | 'waived' | '';
    amount: string;
    currency: string;
    description: string;
    receipt_url: string;
  }>({
    direction: (stop.payments?.direction as any) || 'collect',
    method: (stop.payments?.method as any) || '',
    status: (stop.payments?.status as any) || 'pending',
    amount:
      typeof stop.payments?.amount_captured === 'number'
        ? String(stop.payments!.amount_captured)
        : typeof stop.payments?.amount_due === 'number'
        ? String(stop.payments!.amount_due)
        : '',
    currency: stop.payments?.currency || 'USD',
    description: stop.payments?.description || '',
    receipt_url: stop.payments?.receipt_url || '',
  });

  // Map helpers
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const dest: LatLng | null = useMemo(() => {
    if (
      typeof stop?.latitude === 'number' &&
      typeof stop?.longitude === 'number'
    ) {
      return { latitude: stop.latitude, longitude: stop.longitude };
    }
    return null;
  }, [stop]);

  const distanceMi = useMemo(() => {
    if (!current || !dest) return null;
    return haversineMiles(
      current.latitude,
      current.longitude,
      dest.latitude,
      dest.longitude,
    );
  }, [current, dest]);

  const withinRadius = useMemo(
    () => (distanceMi ?? Infinity) <= TWO_MILES,
    [distanceMi],
  );
  const radiusGateOk = devBypassRadius || withinRadius;

  const distanceDisplayMi = useMemo(() => {
    if (routeDistanceM != null) return (routeDistanceM / 1609.344).toFixed(1);
    if (distanceMi != null) return distanceMi.toFixed(1);
    return null;
  }, [routeDistanceM, distanceMi]);

  const etaDisplayMin = useMemo(() => {
    if (routeDurationS != null) return Math.ceil(routeDurationS / 60);
    if (distanceMi == null) return null;
    return Math.ceil((distanceMi / DEFAULT_AVG_MPH) * 60);
  }, [routeDurationS, distanceMi]);

  const timeWindow = useMemo(() => {
    const s = hhmmFromMaybeISO(stop.time_window_start);
    const e = hhmmFromMaybeISO(stop.time_window_end);
    if (!s && !e) return '—';
    if (s && e) return `${s} – ${e}`;
    return s || e || '—';
  }, [stop?.time_window_start, stop?.time_window_end]);

  const addressLine = [
    stop.address_line1,
    stop.address_line2,
    [stop.city, stop.region].filter(Boolean).join(', '),
    [stop.postal_code, stop.country_code].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' • ');

  // ───────── location: request & watch ─────────
  useEffect(() => {
    requestAndWatchLocation();
    return () => {
      if (watchId != null) Geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect');
      loadStop();
    }, []),
  );

  const loadStop = async () => {
    console.log('loadStop', stop.id);
    const res = await getStopById(stop.id);
    console.log('res', res);
    setStop(res.data);
    console.log('res.data.photos', res.data.photos);
    setInvoiceImages(
      res.data.photos?.filter(
        p => p.photo_category === 'invoice' && p.source === 'driver',
      ) || [],
    );
    setOtherImages(
      res.data.photos?.filter(
        p => p.photo_category === 'product' && p.source === 'driver',
      ) || [],
    );
    setAdminPhotos(res.data.photos?.filter(p => p.source === 'admin') || []);
  };

  const requestAndWatchLocation = async () => {
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location needed',
          'Enable location to calculate ETA and allow arrival confirmation.',
        );
        return;
      }
      Geolocation.getCurrentPosition(
        pos => {
          const here = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setCurrent(here);
        },
        err => console.warn('getCurrentPosition error', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
      const id = Geolocation.watchPosition(
        pos =>
          setCurrent({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        err => console.warn('watchPosition error', err),
        {
          enableHighAccuracy: true,
          distanceFilter: 50,
          interval: 7000,
          fastestInterval: 4000,
        },
      );
      setWatchId(id);
    } catch (e) {
      console.warn('Location error', e);
    }
  };

  // ───────── Mapbox Directions ─────────
  useEffect(() => {
    const fetchRouteIfNeeded = async () => {
      if (!current || !dest) return;
      const movedEnough =
        !lastOriginRef.current ||
        haversineMiles(
          current.latitude,
          current.longitude,
          lastOriginRef.current.latitude,
          lastOriginRef.current.longitude,
        ) > 0.2;

      if (!routeShape || movedEnough) {
        await getRoute(
          current.longitude,
          current.latitude,
          dest.longitude,
          dest.latitude,
        );
        lastOriginRef.current = current;
      }
    };
    fetchRouteIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.latitude, current?.longitude, dest?.latitude, dest?.longitude]);

  const getRoute = async (
    originLng: number,
    originLat: number,
    destLng: number,
    destLat: number,
  ) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      const route = json?.routes?.[0];
      if (route?.geometry?.coordinates) {
        const fc = {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: route.geometry.coordinates,
              },
            },
          ],
        };
        setRouteShape(fc);
        setRouteDistanceM(route.distance ?? null);
        setRouteDurationS(route.duration ?? null);

        const [minLng, minLat, maxLng, maxLat] = bboxFromCoordinates(
          route.geometry.coordinates,
        );
        if (cameraRef.current) {
          cameraRef.current.fitBounds(
            [minLng, minLat],
            [maxLng, maxLat],
            50,
            900,
          );
        }
      } else {
        setRouteShape(null);
        setRouteDistanceM(null);
        setRouteDurationS(null);
        if (cameraRef.current) {
          const minLat = Math.min(originLat, destLat);
          const maxLat = Math.max(originLat, destLat);
          const minLng = Math.min(originLng, destLng);
          const maxLng = Math.max(originLng, destLng);
          cameraRef.current.fitBounds(
            [minLng, minLat],
            [maxLng, maxLat],
            50,
            800,
          );
        }
      }
    } catch (e) {
      console.warn('Directions fetch failed', e);
    }
  };

  // ───────── navigation intent ─────────
  const navigateTo = async () => {
    if (!dest) return Alert.alert('Missing destination coordinates');
    const label = encodeURIComponent(stop.business_name || 'Destination');
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`;
    const tryOpen = async (url: string) => {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return true;
        }
      } catch {}
      return false;
    };
    if (Platform.OS === 'ios') {
      const gmaps = `comgooglemaps://?daddr=${dest.latitude},${dest.longitude}&directionsmode=driving`;
      if (await tryOpen(gmaps)) return;
      const apple = `maps://?daddr=${dest.latitude},${dest.longitude}&dirflg=d`;
      if (await tryOpen(apple)) return;
      await Linking.openURL(webUrl);
    } else {
      const gnav = `google.navigation:q=${dest.latitude},${dest.longitude}&mode=d`;
      if (await tryOpen(gnav)) return;
      const geo = `geo:0,0?q=${dest.latitude},${dest.longitude}(${label})`;
      if (await tryOpen(geo)) return;
      await Linking.openURL(webUrl);
    }
  };

  // ───────── arrival & status ─────────
  const [showAll, setShowAll] = useState<boolean>(false);
  const canShowPhotos = radiusGateOk || showAll;

  const handleArrived = async () => {
    if (!radiusGateOk) {
      return Alert.alert('Too far', 'Get within 2 miles to mark as arrived.');
    }
    try {
      const updatedStop = await updateStopStatus(stop.id, {
        status: 'arrived',
        arrived_at: new Date().toISOString(),
      });
      setStop(updatedStop.data);
      Alert.alert('Arrived', 'Arrival has been recorded.');

      await createNotification(
        'Driver Arrived',
        `${profile?.first_name} ${profile?.last_name?.[0]}. has arrived at ${stop.business_name}`,
      );
      setShowAll(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark arrival.');
    }
  };

  const createNotification = async (title: string, body: string) => {
    // NOTE: The original code used 'invite.business_id', but the context was 'business.id'.
    // I'm using 'invite.business_id' as provided in your prompt, but verify this is correct.
    const admin = await getBusinessAdmin(business?.id ?? 0);
    console.log('admin list', admin);

    if (admin.data.length > 0) {
      // 1. FILTER: First, filter the admin data to only include those with a valid apns_token.
      const adminsWithToken = admin.data.filter((a: any) => {
        const token = a?.profile?.device?.[0]?.apns_token;
        // A concise check for a non-empty string: it's not null/undefined AND its length > 0
        return typeof token === 'string' && token.length > 0;
      });

      // 2. MAP: Then, create an array of Promises only for the filtered admins.
      const sendPromises = adminsWithToken.map(async (a: any) => {
        console.log('admin found', a);
        const token = a.profile.device[0].apns_token;

        const payload = {
          title: title,
          body: body,
          data: 'This is notification data',
          token: token,
          token_type: Platform.OS,
          sendAt: 1000,
        };

        const res = await sendNotification(payload);
        return res?.success; // Return the success status of the send attempt
      });

      // 3. AWAIT: Wait for all successful promises to complete.
      // If 'adminsWithToken' is empty, 'sendPromises' is empty, and Promise.all resolves immediately.
      const results = await Promise.all(sendPromises);

      // Return true if at least one notification attempt was successful.
      return results.some(success => success);
    }
    return true;
  };

  // ───────── photos: add/remove/upload ─────────
  const openPickerFor = (bucket: 'invoice' | 'other') => {
    if (!(radiusGateOk || stop.status === 'arrived')) {
      Alert.alert(
        'Locked',
        'You can upload photos after you arrive (within 2 miles).',
      );
      return;
    }
    setActiveBucket(bucket);
    setPickerVisible(true);
  };

  const addPhotoTo = (bucket: 'invoice' | 'other', item: imageItem) => {
    if (bucket === 'invoice') setInvoiceImages(prev => [item, ...prev]);
    else setOtherImages(prev => [item, ...prev]);
  };

  const removePhotoFrom = (bucket: 'invoice' | 'other', id: string) => {
    if (bucket === 'invoice')
      setInvoiceImages(prev => prev.filter(x => x.id !== id));
    else setOtherImages(prev => prev.filter(x => x.id !== id));
  };

  function buildProofPayload() {
    // Anything you want to keep as proof for this stop
    return {
      confirms: {
        gaveInvoice: !!actions.gaveInvoiceConfirmed,
        signature: !!actions.signatureImage,
        idChecked: !!actions.idCheckedConfirmed,
        contactBefore: !!actions.calledContactConfirmed,
        contactless: !!actions.contactlessDropConfirmed,
        dockAppt: !!actions.dockApptConfirmed,
      },
      printedName: actions.printedName || null,
      temperatureF: actions.tempReadingF ?? null,
      // Store the driver-uploaded URLs (not admin photos)
      driverPhotos: {
        invoice: invoiceImages.map(i => i.uri ?? i.photo_url).filter(Boolean),
        other: otherImages.map(i => i.uri ?? i.photo_url).filter(Boolean),
      },
      payment: paymentRequired
        ? {
            direction:
              paymentForm.direction || stop.payments?.direction || 'collect',
            method: paymentForm.method,
            status: paymentForm.status,
            amount: paymentForm.amount ? Number(paymentForm.amount) : null,
            currency: paymentForm.currency || 'USD',
            description: paymentForm.description || null,
            receipt_url: paymentForm.receipt_url || null,
          }
        : null,
    };
  }

  const handleConfirmAndComplete = async () => {
    if (!isValid) return; // button is disabled anyway
    try {
      setConfirmLoading(true);

      const proofPayload = buildProofPayload();

      // compute minutes at stop (non-negative, integer)
      const now = new Date();
      const departedAtIso = now.toISOString();

      let serviceMinutesActual: number | null = null;
      if (stop.arrived_at) {
        const arriveMs = new Date(stop.arrived_at).getTime();
        if (!Number.isNaN(arriveMs)) {
          const diffMin = (now.getTime() - arriveMs) / 60000;
          // round to nearest whole minute; ensure non-negative
          serviceMinutesActual = Math.max(0, Math.round(diffMin));
        }
      }

      const payload: any = {
        status: 'completed',
        departed_at: departedAtIso,
        service_minutes_actual: serviceMinutesActual, // bigint >= 0 or null
        proof: proofPayload,
        checklist_complete: true,
      };

      const updated = await updateStopStatus(stop.id, payload);

      const payloadPayment = {
        stop_id: stop.payments?.id,
        amount_captured: Number(paymentForm.amount) || 0,
        amount_difference:
          Number(stop.payments?.amount_due) - Number(paymentForm.amount) || 0,
        actual_method: paymentForm.method,
        actual_direction: paymentForm.direction,
      };

      console.log('payloadPayment', payloadPayment);

      const updatedPayment = await updateStopPayment(
        stop.payments?.id ?? 0,
        payloadPayment,
      );
      console.log('updatedPayment', updatedPayment);

      await createNotification(
        'Stop Completed',
        `${profile?.first_name} ${profile?.last_name?.[0]}. has completed stop at ${stop.business_name}`,
      );

      setStop(updated.data);
      setConfirmVisible(false);

      // optional toast/alert — remove if you want zero UI friction
      // Alert.alert('Completed', 'Stop closed successfully');

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to close stop.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const uploadFrom = async (source: 'camera' | 'gallery') => {
    if (!activeBucket) {
      setPickerVisible(false);
      return;
    }
    try {
      const asset =
        source === 'camera'
          ? await takePhotoWithCamera()
          : await pickImageFromGallery();
      if (!asset?.uri) {
        setPickerVisible(false);
        return;
      }

      // Upload to your storage
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.type || 'image/jpeg',
      } as any);
      const res = await uploadImage(formData);
      if (!res?.success || !res?.url) throw new Error('Upload failed');

      addPhotoTo(activeBucket, {
        id: res.url,
        uri: asset.uri,
        fileName: asset.fileName,
        type: asset.type,
        size: asset.size,
        uri: res.url || null,
      });

      // Persist to DB (category mapped by bucket)
      await createStopsPhotos({
        stop_id: stop.id,
        business_id: business.id,
        uploaded_by: profile.id,
        photo_category: activeBucket === 'invoice' ? 'invoice' : 'product',
        photo_url: res.url,
        storage_path: asset?.uri ?? null,
        mime_type: asset?.type ?? null,
        byte_size: asset?.size ?? null,
        width: asset?.width ?? null,
        height: asset?.height ?? null,
        source: 'driver',
      });
    } catch (e: any) {
      console.warn('upload error', e);
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setPickerVisible(false);
      setActiveBucket(null);
      loadStop();
    }
  };

  // ───────── VALIDATION ─────────
  const { isValid, errors, paymentRequired } = useMemo(() => {
    const errs: string[] = [];
    const r = stop.requirements || {};

    // Photos
    if (r.require_photo_invoice && invoiceImages.length < 1) {
      errs.push('At least 1 invoice photo is required.');
    }
    if (r.require_photo_products && otherImages.length < 1) {
      errs.push('At least 1 product photo is required.');
    }

    // Determine if payment is required:
    // Rule: if stop has a payment object and either direction is 'collect'
    // or there's a positive amount_due, we require payment entry.
    const payReq =
      !!stop.payments &&
      (stop.payments.direction === 'collect' ||
        (Number(stop.payments.amount_due) || 0) > 0);

    // Payment validation (only if required)
    if (payReq) {
      if (!paymentForm.method) errs.push('Select a payment method.');
      if (!paymentForm.status) errs.push('Select a payment status.');
      const needsAmount = paymentForm.status !== 'waived';
      const amtOk = !needsAmount
        ? true
        : (() => {
            if (!paymentForm.amount?.trim()) return false;
            const n = Number(paymentForm.amount);
            return Number.isFinite(n) && n > 0;
          })();
      if (!amtOk)
        errs.push('Enter a positive payment amount (or mark waived).');
    }

    // Requirement-driven actionable items
    if (r.give_invoice && !actions.gaveInvoiceConfirmed) {
      errs.push('Confirm invoice was given.');
    }
    if (r.signature && !actions.signatureImage) {
      errs.push('Customer signature required.');
    }

    if (r.print_name === true && !actions.printedName?.trim()) {
      errs.push('Printed name is required.');
    }
    if (r.contact_before && !actions.calledContactConfirmed) {
      errs.push('Confirm you contacted the recipient before delivery.');
    }
    if (r.contactless && !actions.contactlessDropConfirmed) {
      errs.push('Confirm contactless drop-off followed.');
    }
    if (r.id_required && !actions.idCheckedConfirmed) {
      errs.push('Confirm ID was read.');
    }
    if (r.dock_appointment && !actions.dockApptConfirmed) {
      errs.push('Confirm dock appointment honored.');
    }
    if (r.temp_control) {
      const t = actions.tempReadingF;
      if (t == null || Number.isNaN(t))
        errs.push('Enter a temperature reading (°F).');
    }

    return {
      isValid: errs.length === 0,
      errors: errs,
      paymentRequired: payReq,
    };
  }, [
    stop.requirements,
    stop.payments,
    invoiceImages,
    otherImages,
    paymentForm,
    actions,
    signatureCollected,
  ]);

  const handleComplete = async () => {
    if (!isValid) {
      Alert.alert('Missing requirements', errors.join('\n'));
      return;
    }
    // Persist any remaining proof fields here if needed (signature, temp, printed name, confirmations)
    // Then complete the stop:
    try {
      const updatedStop = await updateStopStatus(stop.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      setStop(updatedStop.data);
      Alert.alert('Completed', 'Stop marked as completed.');
      (navigation as any).goBack?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to complete stop.');
    }
  };

  // ───────── render ─────────
  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[tw`px-4 pt-5 pb-3 flex-row items-center`]}>
        <TouchableOpacity
          onPress={() => (navigation as any).goBack?.()}
          style={[
            tw`mr-3 rounded-full p-2`,
            { backgroundColor: colors.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft width={18} height={18} color={colors.text} />
        </TouchableOpacity>

        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-center justify-between`}>
            <Text
              style={[tw`text-2xl font-bold`, { color: colors.text }]}
              numberOfLines={1}
            >
              {stop.business_name}
            </Text>
            {DevMode && (
              <TouchableOpacity
                onPress={() => setDevBypassRadius(v => !v)}
                style={[
                  tw`px-2 py-1 rounded-full`,
                  { backgroundColor: devBypassRadius ? '#EF4444' : '#10B981' },
                ]}
              >
                <Text style={tw`text-white text-2xs font-bold`}>
                  {devBypassRadius ? 'DEV: 2mi Gate OFF' : 'DEV: 2mi Gate ON'}
                </Text>
              </TouchableOpacity>
            )}
            <StopStatusChip status={stop.status} />
          </View>
          <Text style={[tw`text-xs`, { color: colors.muted }]}>
            {stop.stop_type ? stop.stop_type.toUpperCase() : 'STOP'} · Seq{' '}
            {stop.sequence ?? '—'}
          </Text>
        </View>
      </View>
      {/* Map */}
      {stop.status !== 'arrived' && (
        <View style={tw`px-4`}>
          <View
            style={[
              tw`rounded-2xl overflow-hidden`,
              { height: 200, backgroundColor: colors.border },
            ]}
          >
            <MapboxGL.MapView
              style={tw`flex-1`}
              styleURL="mapbox://styles/mapbox/streets-v12"
              logoEnabled={false}
              compassEnabled
            >
              <MapboxGL.Camera
                ref={cameraRef}
                zoomLevel={12}
                centerCoordinate={
                  dest ? [dest.longitude, dest.latitude] : [-118.2437, 34.0522]
                }
              />
              {current ? (
                <MapboxGL.PointAnnotation
                  id="me"
                  coordinate={[current.longitude, current.latitude]}
                />
              ) : null}
              {dest ? (
                <MapboxGL.PointAnnotation
                  id="dest"
                  coordinate={[dest.longitude, dest.latitude]}
                />
              ) : null}
              {routeShape ? (
                <MapboxGL.ShapeSource id="route" shape={routeShape}>
                  <MapboxGL.LineLayer
                    id="routeLine"
                    style={{
                      lineColor: '#2563eb',
                      lineWidth: 4,
                      lineOpacity: 0.9,
                    }}
                  />
                </MapboxGL.ShapeSource>
              ) : null}
            </MapboxGL.MapView>

            <TouchableOpacity
              onPress={navigateTo}
              style={[
                tw`absolute bottom-2 right-2 px-3 py-1.5 rounded-xl`,
                { backgroundColor: colors.brand?.primary },
              ]}
            >
              <Text style={tw`text-white text-xs font-semibold`}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Stats strip */}
      {stop.status !== 'arrived' && (
        <View style={tw`px-4 mt-3`}>
          <View
            style={[
              tw`rounded-2xl p-3 flex-row`,
              { backgroundColor: colors.borderSecondary || colors.border },
            ]}
          >
            <Stat
              label="Distance"
              value={distanceDisplayMi ? `${distanceDisplayMi} mi` : '—'}
              colors={colors}
            />
            <View style={tw`w-3`} />
            <Stat
              label="ETA"
              value={etaDisplayMin != null ? `${etaDisplayMin} min` : '—'}
              colors={colors}
            />
            <View style={tw`w-3`} />
            <Stat label="Window" value={timeWindow} colors={colors} />
          </View>
        </View>
      )}
      {/* Content */}
      <ScrollView style={tw`px-4`} contentContainerStyle={tw`pb-6`}>
        {/* Address & Contact */}
        <View style={tw`mt-3`}>
          <Card colors={colors}>
            <Row
              icon={<MapPin width={14} height={14} color={colors.muted} />}
              label="Address"
              value={addressLine}
            />
            <Row
              icon={<Phone width={14} height={14} color={colors.muted} />}
              label="Contact"
              value={
                [
                  stop.contact_name,
                  formatPhone(stop.contact_phone),
                  stop.contact_email,
                ]
                  .filter(Boolean)
                  .join(' • ') || '—'
              }
              trailing={
                stop.contact_phone ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${stop.contact_phone}`)}
                  >
                    <Text
                      style={[
                        tw`text-xs font-semibold`,
                        { color: colors.brand?.primary || '#2563eb' },
                      ]}
                    >
                      Call
                    </Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          </Card>
        </View>

        {/* Requirements read cards (keep your visibility rules) */}
        {!radiusGateOk || stop.status !== 'arrived' ? (
          <Card colors={colors} title="Before You Arrive">
            <View style={tw`flex-row flex-wrap`}>
              <HalfFlag
                label="Two-person"
                active={!!stop.requirements?.two_person}
              />
              <HalfFlag
                label="Lift gate"
                active={!!stop.requirements?.lift_gate_required}
              />
              <HalfFlag
                label="Contact before"
                active={!!stop.requirements?.contact_before}
              />
              <HalfFlag
                label="Contactless"
                active={!!stop.requirements?.contactless}
              />
              <HalfFlag
                label="ID required"
                active={!!stop.requirements?.id_required}
              />
            </View>
            {!!stop.requirements?.notes && (
              <NoteLine
                colors={colors}
                label="Notes"
                text={String(stop.requirements?.notes)}
              />
            )}
            {!!stop.requirements?.access_info && (
              <NoteLine
                colors={colors}
                label="Access info"
                text={String(stop.requirements?.access_info)}
              />
            )}
            {!!stop.requirements?.access_code && (
              <NoteLine
                colors={colors}
                label="Access code"
                text={String(stop.requirements?.access_code)}
              />
            )}
            <InfoBanner
              colors={colors}
              text="Full details unlock after you tap Arrived (within 2 miles)."
            />
          </Card>
        ) : (
          <>
            <Card colors={colors} title="Requirements & Access">
              <View style={tw`flex-row flex-wrap`}>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="Two-person"
                    active={!!stop.requirements?.two_person}
                  />
                </View>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="Dock appt"
                    active={!!stop.requirements?.dock_appointment}
                  />
                </View>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="ID required"
                    active={!!stop.requirements?.id_required}
                  />
                </View>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="Contact before"
                    active={!!stop.requirements?.contact_before}
                  />
                </View>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="Contactless"
                    active={!!stop.requirements?.contactless}
                  />
                </View>
                <View style={tw`w-[49%]`}>
                  <InlineFlag
                    label="Dock appt"
                    active={!!stop.requirements?.dock_appointment}
                  />
                </View>
              </View>
              <View style={tw`w-full`}>
                <KV
                  label="Access info"
                  value={stop.requirements?.access_info || '—'}
                />
              </View>
              <View style={tw`w-full`}>
                <KV
                  label="Access code"
                  value={stop.requirements?.access_code || '—'}
                />
              </View>
              <View style={tw`w-full`}>
                <KV label="Parking" value={stop.requirements?.parking || '—'} />
              </View>
              <View style={tw`w-full`}>
                <KV
                  label="Entrance"
                  value={stop.requirements?.entrance || '—'}
                />
              </View>
            </Card>
            <Card colors={colors} title="Upon Arrival">
              <InlineFlag
                label="Give invoice"
                active={!!stop.requirements?.give_invoice}
              />
              <InlineFlag
                label="Collect signature"
                active={!!stop.requirements?.signature}
              />
              <InlineFlag
                label="Print name"
                active={!!stop.requirements?.print_name}
              />
              <InlineFlag
                label="Photo: invoice"
                active={!!stop.requirements?.require_photo_invoice}
              />
              <InlineFlag
                label="Photo: products"
                active={!!stop.requirements?.require_photo_products}
              />
              {Boolean(stop.requirements?.notes) ? (
                <NoteLine
                  colors={colors}
                  text={String(stop.requirements?.notes)}
                />
              ) : null}
            </Card>

            {/* NEW: Actionable inputs tied to flags */}

            {/* Existing DB photos (read-only) */}
            {canShowPhotos &&
            Array.isArray(stop.photos) &&
            stop.photos.length > 0 ? (
              <Card colors={colors} title="Photos on File">
                <View style={tw`flex-row flex-wrap -mx-1`}>
                  {adminPhotos.map(p => (
                    <TouchableOpacity
                      key={`${p.photo_url}-${p.id ?? Math.random()}`}
                      onPress={() => Linking.openURL(p.photo_url)}
                      style={tw`w-1/3 p-1`}
                    >
                      <Image
                        source={{ uri: p.photo_url }}
                        style={tw`w-full h-28 rounded-xl`}
                        resizeMode="cover"
                      />
                      {p.photo_category ? (
                        <Text
                          style={[tw`text-2xs mt-1`, { color: colors.muted }]}
                          numberOfLines={1}
                        >
                          {p.photo_category}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            ) : null}

            <CardInput colors={colors} title="Required Actions">
              {stop.requirements?.give_invoice === true ? (
                <ToggleRow
                  label="Invoice Given"
                  value={!!actions.gaveInvoiceConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, gaveInvoiceConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}
              {stop.requirements?.signature === true ? (
                <>
                  <View style={tw`mb-3`}>
                    <Text style={[tw`text-2xs mb-1`, { color: colors.muted }]}>
                      Print Name
                    </Text>
                    <TextInput
                      placeholder="Recipient printed name"
                      value={actions.signature || ''}
                      onChangeText={t =>
                        setActions(prev => ({ ...prev, signature: t }))
                      }
                      style={[
                        tw`px-3 py-2 rounded-xl`,
                        {
                          backgroundColor: colors.borderSecondary,
                          color: colors.text,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : null}

              {stop.requirements?.signature === true ? (
                <ToggleRow
                  label="Signature Collected"
                  value={!!actions.signatureImage}
                  onChange={v => setActions(p => ({ ...p, signatureImage: v }))}
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.print_name === true ? (
                <View style={tw`mb-3`}>
                  <Text style={[tw`text-2xs mb-1`, { color: colors.muted }]}>
                    Printed Name
                  </Text>
                  <TextInput
                    placeholder="Recipient printed name"
                    value={actions.printedName || ''}
                    onChangeText={t =>
                      setActions(prev => ({ ...prev, printedName: t }))
                    }
                    style={[
                      tw`px-3 py-2 rounded-xl`,
                      {
                        backgroundColor: colors.borderSecondary,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>
              ) : null}

              {stop.requirements?.give_invoice ? (
                <ToggleRow
                  label="Invoice Given"
                  value={!!actions.gaveInvoiceConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, gaveInvoiceConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.id_required ? (
                <ToggleRow
                  label="ID Checked"
                  value={!!actions.idCheckedConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, idCheckedConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.contact_before ? (
                <ToggleRow
                  label="Contacted Before Delivery"
                  value={!!actions.calledContactConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, calledContactConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.contactless ? (
                <ToggleRow
                  label="Contactless Drop-off Followed"
                  value={!!actions.contactlessDropConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, contactlessDropConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.dock_appointment ? (
                <ToggleRow
                  label="Dock Appointment Honored"
                  value={!!actions.dockApptConfirmed}
                  onChange={v =>
                    setActions(p => ({ ...p, dockApptConfirmed: v }))
                  }
                  colors={colors}
                />
              ) : null}

              {stop.requirements?.temp_control ? (
                <View style={tw`mb-2`}>
                  <Text style={[tw`text-2xs mb-1`, { color: colors.muted }]}>
                    Temperature Reading (°F)
                  </Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="e.g., 38"
                    value={
                      actions.tempReadingF != null
                        ? String(actions.tempReadingF)
                        : ''
                    }
                    onChangeText={t =>
                      setActions(prev => ({
                        ...prev,
                        tempReadingF: t ? Number(t) : null,
                      }))
                    }
                    style={[
                      tw`px-3 py-2 rounded-xl`,
                      {
                        backgroundColor: colors.borderSecondary,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>
              ) : null}

              {/* {stop.requirements?.access_code ? (
                <View>
                  <Text style={[tw`text-2xs mb-1`, { color: colors.muted }]}>
                    Access Code Used
                  </Text>
                  <TextInput
                    placeholder="Enter the code you used"
                    value={actions.accessCodeEntered || ''}
                    onChangeText={t =>
                      setActions(prev => ({ ...prev, accessCodeEntered: t }))
                    }
                    style={[
                      tw`px-3 py-2 rounded-xl`,
                      {
                        backgroundColor: colors.borderSecondary,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>
              ) : null} */}
            </CardInput>

            {/* NEW: Two photo buckets */}
            <CardInput
              colors={colors}
              title={`Invoice Photos ${
                stop.requirements?.require_photo_invoice
                  ? '(Required)'
                  : '(Optional)'
              }`}
            >
              <PhotoBucket
                colors={colors}
                images={invoiceImages}
                onAdd={() => openPickerFor('invoice')}
                onRemove={id => removePhotoFrom('invoice', id)}
              />
            </CardInput>

            <CardInput
              colors={colors}
              title={`Product/Other Photos ${
                stop.requirements?.require_photo_products
                  ? '(Required)'
                  : '(Optional)'
              }`}
            >
              <PhotoBucket
                colors={colors}
                images={otherImages}
                onAdd={() => openPickerFor('other')}
                onRemove={id => removePhotoFrom('other', id)}
              />
            </CardInput>

            {/* Payment */}
            {paymentRequired ? (
              <CardInput colors={colors} title="Record Payment (Required)">
                {/* Method */}
                <Text style={[tw`text-2xs mb-1 mt-1`, { color: colors.muted }]}>
                  Method
                </Text>
                <SegmentRow
                  options={['cash', 'card', 'check', 'zelle', 'other']}
                  value={paymentForm.method}
                  onChange={v =>
                    setPaymentForm(f => ({ ...f, method: v as any }))
                  }
                  colors={colors}
                />
                {/* Status */}
                <Text style={[tw`text-2xs mb-1 mt-3`, { color: colors.muted }]}>
                  Status
                </Text>
                <SegmentRow
                  options={['collected', 'pending', 'failed', 'waived']}
                  value={paymentForm.status}
                  onChange={v =>
                    setPaymentForm(f => ({ ...f, status: v as any }))
                  }
                  colors={colors}
                />
                {/* Amount */}
                <View style={tw`mt-3`}>
                  <Text style={[tw`text-2xs mb-1`, { color: colors.muted }]}>
                    Amount ({paymentForm.currency})
                  </Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChangeText={t =>
                      setPaymentForm(f => ({ ...f, amount: t }))
                    }
                    style={[
                      tw`px-3 py-2 rounded-xl`,
                      {
                        backgroundColor: colors.borderSecondary,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>
                {/* Optional note */}
                <Text style={[tw`text-2xs mb-1 mt-3`, { color: colors.muted }]}>
                  Description / Note
                </Text>
                <TextInput
                  placeholder="Any notes for this payment…"
                  value={paymentForm.description}
                  onChangeText={t =>
                    setPaymentForm(f => ({ ...f, description: t }))
                  }
                  style={[
                    tw`px-3 py-2 rounded-xl`,
                    {
                      backgroundColor: colors.borderSecondary,
                      color: colors.text,
                    },
                  ]}
                  multiline
                />
              </CardInput>
            ) : (
              <InfoBanner
                colors={colors}
                text="Payment not required for this stop."
              />
            )}

            {/* Inline validation errors (only show when there are any) */}
            {errors.length > 0 ? (
              <View
                style={[
                  tw`rounded-2xl p-3 mt-2`,
                  { backgroundColor: '#2b2f3a' },
                ]}
              >
                <Text
                  style={[tw`text-xs font-semibold mb-1`, { color: '#fecaca' }]}
                >
                  Fix before completing:
                </Text>
                {errors.map(e => (
                  <Text key={e} style={tw`text-red-300 text-2xs`}>
                    • {e}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}

        {!radiusGateOk ? (
          <InfoBanner
            colors={colors}
            text="Photo upload unlocks when you’re within 2 miles or after you mark Arrived."
          />
        ) : null}
      </ScrollView>
      {/* Footer actions */}
      {stop.status === 'arrived' ? (
        <View
          style={[
            tw`px-4 py-3 flex-row`,
            { borderTopWidth: 1, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => setConfirmVisible(true)} // 👈 open modal instead
            disabled={!isValid}
            style={[
              tw`flex-1 px-3 py-2 rounded-xl flex-row items-center justify-center`,
              {
                backgroundColor: isValid
                  ? colors.brand?.primary || '#2563eb'
                  : '#4b5563',
              },
            ]}
          >
            <CheckCircle width={16} height={16} color="#fff" />
            <Text style={tw`text-white font-semibold ml-2`}>Complete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View
            style={[
              tw`px-4 py-3 flex-row`,
              { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={navigateTo}
              style={[
                tw`flex-1 mr-2 px-3 py-2 rounded-xl flex-row items-center justify-center`,
                { backgroundColor: colors.brand?.primary || '#2563eb' },
              ]}
            >
              <NavIcon width={16} height={16} color={'#fff'} />
              <Text style={[tw`ml-2 font-semibold`, { color: '#fff' }]}>
                Navigate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleArrived}
              disabled={!radiusGateOk}
              style={[
                tw`flex-1 px-3 py-2 rounded-xl flex-row items-center justify-center`,
                {
                  backgroundColor: radiusGateOk
                    ? colors.brand?.primary || '#2563eb'
                    : '#1f2937',
                  opacity: radiusGateOk ? 1 : 0.7,
                },
              ]}
            >
              <CheckCircle width={16} height={16} color="#fff" />
              <Text style={tw`text-white font-semibold ml-2`}>Arrived</Text>
            </TouchableOpacity>
          </View>

          {!radiusGateOk ? (
            <View style={tw`px-4 pb-3`}>
              <InfoBanner
                colors={colors}
                text="You must be within 2 miles of the destination to mark Arrived."
              />
            </View>
          ) : null}
        </View>
      )}
      {/* Add Photo Picker Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={tw`flex-1 bg-black/40`}>
          <View
            style={[
              tw`mt-auto rounded-t-3xl p-4 pb-12`,
              { backgroundColor: colors.main },
            ]}
          >
            <View style={tw`flex-row items-center mb-3`}>
              <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
                Add Photo
              </Text>
              <View style={tw`flex-1`} />
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <X width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => uploadFrom('camera')}
              style={[
                tw`px-4 py-3 rounded-2xl mb-2 flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <Camera width={18} height={18} color={colors.text} />
              <Text style={[tw`ml-2`, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => uploadFrom('gallery')}
              style={[
                tw`px-4 py-3 rounded-2xl flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <ImageIcon width={18} height={18} color={colors.text} />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={confirmVisible}
        onRequestClose={() => setConfirmVisible(false)}
      >
        console.log('confirmVisible', confirmVisible); return (
        <>
          <View style={tw`flex-1 bg-black/40`}>
            <View
              style={[
                tw`mt-auto rounded-t-3xl p-4 pb-6`,
                { backgroundColor: colors.main },
              ]}
            >
              {/* Header */}
              <View style={tw`flex-row items-center mb-3`}>
                <Text
                  style={[tw`text-xl font-semibold`, { color: colors.text }]}
                >
                  Confirm Stop Completion
                </Text>
                <View style={tw`flex-1`} />
                <TouchableOpacity onPress={() => setConfirmVisible(false)}>
                  <X width={22} height={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Summary card */}
              <View
                style={[
                  tw`rounded-2xl p-3 mb-3`,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    tw`text-sm font-semibold mb-2`,
                    { color: colors.text },
                  ]}
                >
                  Summary
                </Text>

                <Row label="Address" value={addressLine} />
                <Row label="Window" value={timeWindow} />
                <Row
                  label="Invoice photos"
                  value={String(invoiceImages.length)}
                />
                <Row label="Other photos" value={String(otherImages.length)} />

                <Row
                  label="Payment"
                  value={
                    paymentRequired
                      ? `${paymentForm.method || '—'} • ${
                          paymentForm.status || '—'
                        }${
                          paymentForm.status !== 'waived' && paymentForm.amount
                            ? ` • ${paymentForm.currency} ${paymentForm.amount}`
                            : ''
                        }`
                      : 'Not required'
                  }
                />

                {/* Quick requirement ticks */}
                <Row
                  label="Signature"
                  value={
                    stop.requirements?.signature
                      ? actions.signatureImage
                        ? 'Captured'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Printed name"
                  value={
                    stop.requirements?.print_name
                      ? actions.printedName?.trim()
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Invoice given"
                  value={
                    stop.requirements?.give_invoice
                      ? actions.gaveInvoiceConfirmed
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="ID checked"
                  value={
                    stop.requirements?.id_required
                      ? actions.idCheckedConfirmed
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Contact before"
                  value={
                    stop.requirements?.contact_before
                      ? actions.calledContactConfirmed
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Contactless"
                  value={
                    stop.requirements?.contactless
                      ? actions.contactlessDropConfirmed
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Dock appt"
                  value={
                    stop.requirements?.dock_appointment
                      ? actions.dockApptConfirmed
                        ? 'OK'
                        : 'Missing'
                      : 'N/A'
                  }
                />
                <Row
                  label="Temperature"
                  value={
                    stop.requirements?.temp_control
                      ? actions.tempReadingF != null
                        ? `${actions.tempReadingF}°F`
                        : 'Missing'
                      : 'N/A'
                  }
                />
              </View>

              {/* Errors, if any */}
              {errors.length > 0 && (
                <View
                  style={[
                    tw`rounded-2xl p-3 mb-3`,
                    { backgroundColor: '#2b2f3a' },
                  ]}
                >
                  <Text
                    style={[
                      tw`text-xs font-semibold mb-1`,
                      { color: '#fecaca' },
                    ]}
                  >
                    Fix these before completing:
                  </Text>
                  {errors.map(e => (
                    <Text key={e} style={tw`text-red-300 text-2xs`}>
                      • {e}
                    </Text>
                  ))}
                </View>
              )}

              {/* Actions */}
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  onPress={() => setConfirmVisible(false)}
                  disabled={confirmLoading}
                  style={[
                    tw`flex-1 mr-2 px-3 py-3 rounded-xl items-center`,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.text }}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmAndComplete}
                  disabled={!isValid || confirmLoading}
                  style={[
                    tw`flex-1 px-3 py-3 rounded-xl items-center`,
                    {
                      backgroundColor:
                        !isValid || confirmLoading
                          ? '#4b5563'
                          : colors.brand?.primary || '#2563eb',
                    },
                  ]}
                >
                  {confirmLoading ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={tw`text-white font-semibold`}>
                      Confirm & Complete
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
        )
      </Modal>
    </View>
  );
}

/* ───────── helpers & small UI ───────── */

function bboxFromCoordinates(coords: number[][]) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat] as const;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hhmmFromMaybeISO(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(m).padStart(2, '0');
  return `${h}:${mm} ${ampm}`;
}

async function requestLocationPermission() {
  if (Platform.OS === 'ios') {
    const auth = await Geolocation.requestAuthorization('whenInUse');
    return auth === 'granted';
  }
  return true;
}

function formatPhone(p?: string | null) {
  if (!p) return '';
  return p.replace(/[^\d+]/g, '');
}

function currency(amount: number, ccy: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
    }).format(amount);
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
}

/* Small UI atoms */

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      style={[tw`flex-1 px-3 py-3 rounded-xl`, { backgroundColor: '#0f172a' }]}
    >
      <Text style={[tw`text-2xs`, { color: '#9CA3AF' }]}>{label}</Text>
      <Text style={[tw`text-lg font-bold mt-0.5`, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function Card({
  children,
  colors,
  title,
}: {
  children: React.ReactNode;
  colors: any;
  title?: string;
}) {
  return (
    <View
      style={[tw`rounded-2xl p-3 mb-3`, { backgroundColor: colors.border }]}
    >
      {title ? (
        <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function CardInput({
  children,
  colors,
  title,
}: {
  children: React.ReactNode;
  colors: any;
  title?: string;
}) {
  return (
    <View
      style={[
        tw`rounded-2xl p-3 mb-3 border-2`,
        { backgroundColor: colors.border, borderColor: colors.brand?.primary },
      ]}
    >
      {title ? (
        <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  trailing,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={tw`flex-row items-center justify-between py-1.5`}>
      <View style={tw`flex-row items-center flex-1 pr-2`}>
        {icon ? <View style={tw`mr-2`}>{icon}</View> : null}
        <Text style={tw`text-2xs text-gray-400 w-22 mr-1`}>{label}</Text>
        <Text style={tw`text-xs flex-1 text-gray-200`} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
      {trailing ? trailing : null}
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={tw`flex-row items-start py-1`}>
      <Text style={tw`text-2xs text-gray-400 w-28`}>{label}</Text>
      <Text style={tw`text-2xs text-gray-100 flex-1`}>{value}</Text>
    </View>
  );
}

function InlineFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <View
      style={[
        tw`px-2 py-1.5 rounded-2 mr-2 mb-2`,
        { backgroundColor: active ? '#10B981' : '#374151' },
      ]}
    >
      <Text style={tw`text-white text-sm`}>{label}</Text>
      <Text style={tw`text-white text-xs`}>
        {active ? 'required' : 'not required'}
      </Text>
    </View>
  );
}

function HalfFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={tw`w-[49%] mb-2`}>
      <InlineFlag label={label} active={active} />
    </View>
  );
}

function InfoBanner({ text, colors }: { text: string; colors: any }) {
  return (
    <View
      style={[
        tw`flex-row items-center px-3 py-2 rounded-xl mt-2`,
        { backgroundColor: colors.border },
      ]}
    >
      <InfoIcon width={14} height={14} color={colors.muted} />
      <Text style={[tw`ml-2 text-xs`, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

function NoteLine({
  label,
  text,
  colors,
}: {
  label: string;
  text: string;
  colors: any;
}) {
  return (
    <View
      style={[
        tw`p-2 rounded-2 mt-2`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      {label ? (
        <Text style={[tw`text-sm`, { color: colors.text }]}>{label}</Text>
      ) : null}
      <Text style={[tw`text-2xs`, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function StopStatusChip({ status }: { status?: string }) {
  const meta = status ? STOP_STATUS_META[status] : undefined;
  const label = meta?.label ?? (status ? String(status) : '—');
  const bg = meta?.bg ?? '#6B7280';
  return (
    <View style={[tw`px-2 py-0.5 rounded-full ml-2`, { backgroundColor: bg }]}>
      <Text style={tw`text-white text-2xs font-semibold`}>{label}</Text>
    </View>
  );
}

function SegmentRow({
  options,
  value,
  onChange,
  colors,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  return (
    <View
      style={[
        tw`flex flex-row w-full items-center justify-between p-1 rounded-2`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      {options.map(opt => {
        const active = value === (opt as any);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              tw`px-2 py-1 rounded-1.5`,
              {
                backgroundColor: active ? colors.brand?.primary : 'transparent',
              },
            ]}
          >
            <Text style={[tw`text-sm`, { color: active ? '#fff' : '#9CA3AF' }]}>
              {opt.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Simple grid for current bucket */
function PhotoBucket({
  colors,
  images,
  onAdd,
  onRemove,
}: {
  colors: any;
  images: imageItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View>
      <View style={tw`flex-row flex-wrap`}>
        {images.map(img => (
          <View
            key={img.id}
            style={[
              tw`mr-2 mb-2 rounded-xl overflow-hidden`,
              { width: 112, height: 112, backgroundColor: colors.border },
            ]}
          >
            <Image
              source={{ uri: img.uri || img.photo_url }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
            <TouchableOpacity
              onPress={() => onRemove(img.id)}
              style={[
                tw`absolute right-1 top-1 rounded-full p-1`,
                { backgroundColor: 'rgba(0,0,0,0.5)' },
              ]}
            >
              <Trash2 width={14} height={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={onAdd}
          style={[
            tw`mr-2 mb-2 rounded-xl items-center justify-center border border-dashed`,
            { width: 112, height: 112, borderColor: colors.muted },
          ]}
        >
          <Text style={[tw`text-2xs`, { color: colors.muted }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View
      style={[
        tw`flex-row items-center justify-between mb-2`,
        {
          backgroundColor: colors.borderSecondary,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
      ]}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

{
  /* Confirm & Complete Modal */
}
