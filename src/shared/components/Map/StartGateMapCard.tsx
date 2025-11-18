import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import tw from 'twrnc';
import { getOneFix, isWithinOneMile } from '../../lib/locations';
import Config from 'react-native-config';
import { getRouteDirections } from '../../lib/NavigationHeloer';
import { MapPin } from 'react-native-feather';
import Logo from '../../assets/m-icon-name-blue.png';

// ───────── Types ─────────
type LatLng = { latitude: number; longitude: number };

type Props = {
  /** Google Maps API key (Directions API enabled). Back-compat: if you pass `token`, it's used as the key. */
  googleApiKey?: string;
  token?: string; // kept for back-compat – used as googleApiKey
  /** Route start point (base / HQ) */
  start: LatLng;
  /** Label used when opening external maps */
  startLabel?: string;
  /** Theme colors from your `useTheme()` */
  colors: any;
  /**
   * Called after each proximity check (initial + polls).
   * Passes `notWithinOneMile` so parent can flip its `startWithin1Mile` state.
   */
  onResolved?: (
    notWithinOneMile: boolean,
    info?: { distanceMiles?: number; etaMinutes?: number; current?: LatLng },
  ) => void;
  /** Polling interval for proximity checks (ms). Defaults to 5000 */
  pollMs?: number;
  /** Optional: allow parent to clock in from here */
  forceClockIn?: () => void;
};

type DirectionsRoute = {
  coordinates: LatLng[]; // decoded from Google encoded polyline
  distance: number; // meters
  duration: number; // seconds
};

// ───────── Helpers ─────────

// Minimal polyline decoder for Google encoded polylines.
function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const path: LatLng[] = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    path.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return path;
}

export default function StartGateMapCard({
  googleApiKey,
  token,
  start,
  startLabel = 'Base / Start',
  colors,
  onResolved,
  pollMs = 5000,
  forceClockIn,
}: Props) {
  // Key for external maps (still needed for openInMaps function)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [dir, setDir] = useState<DirectionsRoute | null>(null);
  const [notWithinOneMile, setNotWithinOneMile] = useState<boolean | null>(
    null,
  );

  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<NodeJS.Timer | null>(null);

  // Current GPS fix
  const readFix = useCallback(async (): Promise<LatLng> => {
    const snap = await getOneFix();
    if (!snap.ok) throw new Error(snap.errorMessage || 'Location unavailable');
    return { latitude: snap.coords.latitude, longitude: snap.coords.longitude };
  }, []);

  // Fetch directions from the secure backend endpoint
  const fetchRoute = useCallback(
    async (cur: LatLng): Promise<DirectionsRoute> => {
      console.log('cur', cur);
      console.log('start', start);
      const origin = `${cur.latitude},${cur.longitude}`;
      const destination = `${start.latitude},${start.longitude}`;

      // 1. Call the secure backend endpoint
      const res = await getRouteDirections({
        start: origin,
        destination: destination,
      });

      console.log('res', res);

      if (!res.success) {
        throw new Error(`Route service failed (${res.message})`);
      }

      const result = res.data;

      // 2. Check the custom backend success flag
      if (!result.success) {
        // Use the detailed error message returned by the server
        throw new Error(
          `Route error: ${result.message || 'Unknown server error'}`,
        );
      }

      const routeData = result.data;

      const overview = routeData.polyline;
      if (!overview) throw new Error('No polyline found in server response');

      const coords = decodePolyline(overview);

      // 3. Map server response to DirectionsRoute type (using meter/second values)
      return {
        coordinates: coords,
        // The server returns these pre-calculated numeric values:
        distance: routeData.distance_meters,
        duration: routeData.duration_seconds,
      };
    },
    // Only dependent on the base URL and the fixed start coordinate
    [start.latitude, start.longitude],
  );

  // Fit camera to current + start
  const fitCamera = useCallback(
    (cur: LatLng) => {
      const coords = [
        { latitude: cur.latitude, longitude: cur.longitude },
        { latitude: start.latitude, longitude: start.longitude },
      ];
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    },
    [start.latitude, start.longitude],
  );

  /** Full refresh: fix + directions + ETA + camera fit */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cur = await readFix();
      setCurrent(cur);

      const w = isWithinOneMile(cur, start);
      const notWithin = !w.within;
      setNotWithinOneMile(notWithin);

      // This now calls your secure backend
      const r = await fetchRoute(cur);
      setDir(r);

      fitCamera(cur);

      onResolved?.(notWithin, {
        current: cur,
        distanceMiles: w.distanceMiles,
        etaMinutes: Math.max(1, Math.round(r.duration / 60)),
      });
    } catch (e: any) {
      console.log(e?.message || 'Unable to determine location');
    } finally {
      setLoading(false);
    }
  }, [fetchRoute, fitCamera, onResolved, readFix, start]);

  // Initial full refresh
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Lightweight proximity polling (does not call Directions each time)
  useEffect(() => {
    const period = Math.max(2000, pollMs);

    // initial light check
    (async () => {
      try {
        const cur = await readFix();
        setCurrent(cur);
        const w = isWithinOneMile(cur, start);
        const notWithin = !w.within;
        setNotWithinOneMile(prev => (prev !== notWithin ? notWithin : prev));
        onResolved?.(notWithin, {
          current: cur,
          distanceMiles: w.distanceMiles,
        });
      } catch {
        /* ignore */
      }
    })();

    pollRef.current = setInterval(async () => {
      try {
        const cur = await readFix();
        setCurrent(cur);
        const w = isWithinOneMile(cur, start);
        const notWithin = !w.within;

        setNotWithinOneMile(prev => {
          if (prev !== notWithin) {
            onResolved?.(notWithin, {
              current: cur,
              distanceMiles: w.distanceMiles,
            });
          }
          return notWithin;
        });
      } catch {
        /* transient errors ignored */
      }
    }, period);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollMs, readFix, start, onResolved]);

  // Derived values for UI
  const distanceMiles = useMemo(
    () => (dir ? dir.distance / 1609.344 : undefined),
    [dir],
  );
  const etaMinutes = useMemo(
    () => (dir ? Math.max(1, Math.round(dir.duration / 60)) : undefined),
    [dir],
  );

  // External Maps deeplinks
  const openInMaps = useCallback(() => {
    const lat = start.latitude;
    const lng = start.longitude;
    const label = encodeURIComponent(startLabel);

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const tryOpen = async (url: string) => {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return true;
        }
      } catch {
        /* noop */
      }
      return false;
    };

    (async () => {
      if (Platform.OS === 'ios') {
        if (
          await tryOpen(
            `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
          )
        )
          return;
        if (await tryOpen(`maps://?daddr=${lat},${lng}&dirflg=d`)) return;
        await Linking.openURL(webUrl);
      } else {
        if (await tryOpen(`google.navigation:q=${lat},${lng}&mode=d`)) return;
        if (await tryOpen(`geo:0,0?q=${lat},${lng}(${label})`)) return;
        await Linking.openURL(webUrl);
      }
    })();
  }, [start.latitude, start.longitude, startLabel]);

  const initialRegion = useMemo(() => {
    const delta = 0.06;
    return {
      latitude: start.latitude,
      longitude: start.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [start.latitude, start.longitude]);

  return (
    <View style={[tw`rounded-2xl overflow-hidden`]}>
      {notWithinOneMile === true ? (
        <View
          style={[
            tw`px-3 py-2 rounded-xl mb-4 text-center`,
            { backgroundColor: colors.border },
          ]}
        >
          <Text style={[tw`text-xs text-center`, { color: colors.text }]}>
            You must be within 1 mile of base to start your route.
          </Text>
          {typeof distanceMiles === 'number' ? (
            <Text
              style={[tw`text-2xs mt-1 text-center`, { color: colors.muted }]}
            >
              Currently ~{distanceMiles.toFixed(2)} miles away.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: 280, backgroundColor: colors.borderSecondary }}>
        <MapView
          ref={mapRef}
          style={tw`flex-1`}
          initialRegion={initialRegion}
          showsCompass
          toolbarEnabled={false}
          rotateEnabled={false}
          // The current prop is essential for showing the user's location dot
          showsUserLocation={current !== null}
        >
          {/* Route line */}
          {dir?.coordinates?.length ? (
            <Polyline
              coordinates={dir.coordinates}
              strokeWidth={4}
              strokeColor="#3B82F6" // Blue
            />
          ) : null}

          {/* Start pin (HQ) - Marker for the destination/base location */}
          <Marker coordinate={start} icon={Logo} />

          {/* Current pin - Marker for the fetched GPS location */}
          {current ? (
            <Marker coordinate={current} icon={Logo}>
              <View
                style={[
                  tw`w-4 h-4 rounded-full`,
                  {
                    backgroundColor: '#F59E0B', // Amber/Orange
                    borderWidth: 2,
                    borderColor: 'white',
                  },
                ]}
              />
            </Marker>
          ) : null}
        </MapView>

        {/* OVERLAY: Route Distance and ETA Details */}

        {/* Loading Indicator Overlay */}
        {loading ? (
          <View
            style={[
              tw`absolute inset-0 items-center justify-center`,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator color={colors.text} size="large" />
          </View>
        ) : null}

        {/* Error Message Overlay (Now correctly set by refresh()) */}
        {error ? (
          <View
            style={[
              tw`absolute left-2 right-2 bottom-2 px-3 py-2 rounded-xl`,
              {
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.error,
                shadowColor: colors.error,
                shadowOpacity: 0.8,
                elevation: 5,
              },
            ]}
          >
            <Text style={[tw`text-xs font-semibold`, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[tw`px-3 py-2`, { backgroundColor: colors.borderSecondary }]}
      >
        <View style={tw`flex justify-between`}>
          <Text style={[tw`text-xs`, { color: colors.muted }]}>
            {typeof distanceMiles === 'number' && typeof etaMinutes === 'number'
              ? `Distance: ${distanceMiles.toFixed(
                  2,
                )} mi • ETA: ${etaMinutes} min`
              : 'Distance/ETA unavailable'}
          </Text>
          <View style={tw`flex-row justify-between items-center`}>
            <View style={tw`flex-row my-4`}>
              <TouchableOpacity
                onPress={openInMaps}
                style={[
                  tw`px-3 py-1 rounded-lg mr-2`,
                  { backgroundColor: colors.brand?.primary },
                ]}
              >
                <Text
                  style={[tw`text-2xs font-semibold`, { color: colors.text }]}
                >
                  Open in Maps
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void refresh()}
                style={[
                  tw`px-3 py-1 rounded-lg`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <Text style={tw`text-white text-2xs font-semibold`}>
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {/* Optional force clock-in */}
            {/* <TouchableOpacity
              onPress={forceClockIn}
              style={[
                tw`px-3 py-1 rounded-lg`,
                { backgroundColor: colors.brand?.primary || '#2563eb' },
              ]}
            >
              <Text style={tw`text-white text-2xs font-semibold`}>
                Clock In
              </Text>
            </TouchableOpacity> */}
          </View>
        </View>
      </View>
    </View>
  );
}
