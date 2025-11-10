// src/shared/components/Map/StartGateMapCard.tsx
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

type LatLng = { latitude: number; longitude: number };

type Props = {
  /** Mapbox access token (used for directions API only) */
  token: string;
  /** Route start point (base) */
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
  /** How often to re-check proximity (ms). Defaults to 5000 */
  pollMs?: number;
  /** Force clock in */
  forceClockIn?: () => void;
};

type DirectionsRoute = {
  coordinates: LatLng[]; // converted from GeoJSON [lng,lat]
  distance: number; // meters
  duration: number; // seconds
};

export default function StartGateMapCard({
  token,
  start,
  startLabel = 'Base / Start',
  colors,
  onResolved,
  pollMs = 5000,
  forceClockIn,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [dir, setDir] = useState<DirectionsRoute | null>(null);
  const [notWithinOneMile, setNotWithinOneMile] = useState<boolean | null>(
    null,
  );

  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<NodeJS.Timer | null>(null);

  const readFix = useCallback(async (): Promise<LatLng> => {
    const snap = await getOneFix();
    if (!snap.ok) throw new Error(snap.errorMessage || 'Location unavailable');
    return { latitude: snap.coords.latitude, longitude: snap.coords.longitude };
  }, []);

  const fetchRoute = useCallback(
    async (cur: LatLng): Promise<DirectionsRoute> => {
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${cur.longitude},${cur.latitude};${start.longitude},${start.latitude}` +
        `?alternatives=false&geometries=geojson&overview=full&annotations=duration,distance&access_token=${encodeURIComponent(
          token,
        )}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Directions failed (${res.status})`);
      const json = await res.json();
      const best = json?.routes?.[0];
      const geom = best?.geometry;
      if (!geom?.coordinates?.length) throw new Error('No route found');

      // convert [lng,lat] -> { latitude, longitude }
      const coords: LatLng[] = geom.coordinates.map(
        (c: [number, number]): LatLng => ({ longitude: c[0], latitude: c[1] }),
      );

      return {
        coordinates: coords,
        distance: best.distance,
        duration: best.duration,
      };
    },
    [start.latitude, start.longitude, token],
  );

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

      const r = await fetchRoute(cur);
      setDir(r);

      fitCamera(cur);

      onResolved?.(notWithin, {
        current: cur,
        distanceMiles: w.distanceMiles,
        etaMinutes: Math.max(1, Math.round(r.duration / 60)),
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to determine location');
    } finally {
      setLoading(false);
    }
  }, [fetchRoute, fitCamera, onResolved, readFix, start]);

  /** Initial full refresh on mount */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Lightweight proximity polling (does not call Directions each time) */
  useEffect(() => {
    const period = Math.max(2000, pollMs);

    // immediate light check
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
        /* ignore transient failures */
      }
    }, period);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollMs, readFix, start, onResolved]);

  const distanceMiles = useMemo(
    () => (dir ? dir.distance / 1609.344 : undefined),
    [dir],
  );
  const etaMinutes = useMemo(
    () => (dir ? Math.max(1, Math.round(dir.duration / 60)) : undefined),
    [dir],
  );

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
            tw`px-3 py-2 rounded-xl mb-4`,
            { backgroundColor: colors.border },
          ]}
        >
          <View style={tw`flex-row items-center w-full justify-center`}>
            <Text
              style={[tw`text-base font-semibold mb-4`, { color: colors.text }]}
            >
              You have to be within 1 mile of base to clock in.
            </Text>
          </View>
          <Text style={[tw`text-xs`, { color: colors.text }]}>
            You must be within 1 mile of base to start your route.
          </Text>
          {typeof distanceMiles === 'number' ? (
            <Text style={[tw`text-2xs mt-1`, { color: colors.muted }]}>
              Currently ~{distanceMiles.toFixed(2)} miles away.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: 240, backgroundColor: colors.borderSecondary }}>
        <MapView
          ref={mapRef}
          style={tw`flex-1`}
          initialRegion={initialRegion}
          showsCompass
          toolbarEnabled={false}
          rotateEnabled={false}
        >
          {/* Route line */}
          {dir?.coordinates?.length ? (
            <Polyline
              coordinates={dir.coordinates}
              strokeWidth={4}
              strokeColor="#3B82F6"
            />
          ) : null}

          {/* Start pin */}
          <Marker coordinate={start}>
            <View
              style={[
                tw`w-4 h-4 rounded-full`,
                {
                  backgroundColor: '#22C55E',
                  borderWidth: 2,
                  borderColor: 'white',
                },
              ]}
            />
          </Marker>

          {/* Current pin */}
          {current ? (
            <Marker coordinate={current}>
              <View
                style={[
                  tw`w-4 h-4 rounded-full`,
                  {
                    backgroundColor: '#F59E0B',
                    borderWidth: 2,
                    borderColor: 'white',
                  },
                ]}
              />
            </Marker>
          ) : null}
        </MapView>

        {loading ? (
          <View style={tw`absolute inset-0 items-center justify-center`}>
            <ActivityIndicator />
          </View>
        ) : null}
        {error ? (
          <View
            style={[
              tw`absolute left-2 right-2 bottom-2 px-3 py-2 rounded-xl`,
              { backgroundColor: '#0b1220' },
            ]}
          >
            <Text style={[tw`text-xs`, { color: '#FCA5A5' }]}>{error}</Text>
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

            {/* Uncomment if/when you enable force clock-in here */}
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
