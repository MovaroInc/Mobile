// src/app/routes/AddStopPhotosScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  X as CloseIcon,
  Check,
} from 'react-native-feather';

import {
  addStopPhoto, // <-- DB insert (must accept photo_category)
  pickImageFromGallery,
  takePhotoWithCamera,
  uploadImage, // <-- multipart upload to storage; returns { success, url }
} from '../../shared/lib/ImageHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../../state/useSession';
import { updateStopStatus } from '../../shared/lib/StopsHelpers';

type LocalImg = { uri: string | null };
type PhotoCategory = 'invoice' | 'other';

type RouteParams = {
  routeId: number;
  stopId: number;
  route?: any;
};

export default function AddStopPhotosScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { profile, business } = useSession();
  const navigation = useNavigation();

  const { params } = useRoute<any>();
  const { routeId, stopsCount } = (params || {}) as RouteParams;
  console.log('stopsCount', stopsCount);
  console.log('routeId', routeId);

  useEffect(() => {
    const getStep2Payload = async () => {
      const step1Payload = await AsyncStorage.getItem('step1Payload');
      console.log('step1Payload', JSON.parse(step1Payload || '{}'));
      const step2Payload = await AsyncStorage.getItem('step2Payload');
      console.log('step2Payload', JSON.parse(step2Payload || '{}'));
    };
    getStep2Payload();
  }, []);

  // One empty slot by default in each section
  const [invoiceImgs, setInvoiceImgs] = useState<LocalImg[]>([{ uri: null }]);
  const [otherImgs, setOtherImgs] = useState<LocalImg[]>([{ uri: null }]);

  // Per-slot uploading state (mirrors array lengths above)
  const [invoiceUploading, setInvoiceUploading] = useState<boolean[]>([false]);
  const [otherUploading, setOtherUploading] = useState<boolean[]>([false]);

  // Per-slot downloadable URLs
  const [invoiceUrls, setInvoiceUrls] = useState<(string | null)[]>([null]);
  const [otherUrls, setOtherUrls] = useState<(string | null)[]>([null]);

  const [invoicePhotoInfo, setInvoicePhotoInfo] = useState<any>(null);
  const [otherPhotoInfo, setOtherPhotoInfo] = useState<any>(null);

  // Which slot is being picked
  const [pickerTarget, setPickerTarget] = useState<null | {
    section: PhotoCategory;
    index: number;
  }>(null);

  useEffect(() => {
    console.log('invoiceImgs', invoiceImgs);
    console.log('otherImgs', otherImgs);
  }, [invoiceImgs, otherImgs]);

  useEffect(() => {
    console.log('invoiceUploading', invoiceUploading);
    console.log('otherImgs', otherUploading);
  }, [invoiceUploading, otherUploading]);

  const openPickerFor = (section: PhotoCategory, index: number) =>
    setPickerTarget({ section, index });

  // --- helpers to keep arrays in sync ---
  const pushSlot = (section: PhotoCategory) => {
    if (section === 'invoice') {
      setInvoiceImgs(prev => [...prev, { uri: null }]);
      setInvoiceUploading(prev => [...prev, false]);
      setInvoiceUrls(prev => [...prev, null]);
    } else {
      setOtherImgs(prev => [...prev, { uri: null }]);
      setOtherUploading(prev => [...prev, false]);
      setOtherUrls(prev => [...prev, null]);
    }
  };

  const resetToSingleEmpty = (section: PhotoCategory) => {
    if (section === 'invoice') {
      setInvoiceImgs([{ uri: null }]);
      setInvoiceUploading([false]);
      setInvoiceUrls([null]);
    } else {
      setOtherImgs([{ uri: null }]);
      setOtherUploading([false]);
      setOtherUrls([null]);
    }
  };

  const filterOutIndex = (arr: any[], index: number) =>
    arr.filter((_, i) => i !== index);

  const removeSlot = (section: PhotoCategory, index: number) => {
    if (section === 'invoice') {
      if (invoiceImgs.length === 1) return resetToSingleEmpty('invoice');
      setInvoiceImgs(prev => filterOutIndex(prev, index));
      setInvoiceUploading(prev => filterOutIndex(prev, index));
      setInvoiceUrls(prev => filterOutIndex(prev, index));
    } else {
      if (otherImgs.length === 1) return resetToSingleEmpty('other');
      setOtherImgs(prev => filterOutIndex(prev, index));
      setOtherUploading(prev => filterOutIndex(prev, index));
      setOtherUrls(prev => filterOutIndex(prev, index));
    }
  };

  const setSlotLocalUri = (
    section: PhotoCategory,
    index: number,
    uri: string | null,
    photoInfo: any,
  ) => {
    if (section === 'invoice') {
      setInvoiceImgs(prev => prev.map((it, i) => (i === index ? { uri } : it)));
      setInvoicePhotoInfo(prev =>
        prev.map((it, i) => (i === index ? photoInfo : it)),
      );
    } else {
      setOtherImgs(prev => prev.map((it, i) => (i === index ? { uri } : it)));
      setOtherPhotoInfo(prev =>
        prev.map((it, i) => (i === index ? photoInfo : it)),
      );
    }
  };

  const setUploading = (
    section: PhotoCategory,
    index: number,
    uploading: boolean,
  ) => {
    if (section === 'invoice') {
      setInvoiceUploading(prev =>
        prev.map((v, i) => (i === index ? uploading : v)),
      );
    } else {
      setOtherUploading(prev =>
        prev.map((v, i) => (i === index ? uploading : v)),
      );
    }
  };

  const setDownloadUrl = (
    section: PhotoCategory,
    index: number,
    url: string | null,
  ) => {
    if (section === 'invoice') {
      setInvoiceUrls(prev => prev.map((v, i) => (i === index ? url : v)));
    } else {
      setOtherUrls(prev => prev.map((v, i) => (i === index ? url : v)));
    }
  };

  // Storage upload (multipart FormData) → returns public URL string or null
  const uploadToStorage = async (asset: any): Promise<string | null> => {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `photo_${Date.now()}.jpg`,
    } as any);

    try {
      const resp = await uploadImage(form); // { success, url }
      if (resp?.success && resp?.url) return resp.url as string;
      return null;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handlePick = async (source: 'camera' | 'gallery') => {
    if (!pickerTarget) return;
    const { section, index } = pickerTarget;

    try {
      const asset =
        source === 'camera'
          ? await takePhotoWithCamera()
          : await pickImageFromGallery();

      if (!asset || !asset.uri) {
        setPickerTarget(null);
        return;
      }

      // 1) local preview
      setSlotLocalUri(section, index, asset.uri);

      // 2) spinner on
      setUploading(section, index, true);

      // 3) upload to storage → url
      const uploadedUrl = await uploadToStorage(asset);
      if (!uploadedUrl) {
        throw new Error('Upload failed. No URL returned.');
      }

      // 4) save row in DB with correct category
      const photoRes = await addStopPhoto({
        business_id: business?.id ?? null,
        stop_id: stopId,
        uploaded_by: profile?.id ?? null,
        photo_category: section, // <<<<<< CLEAR: this is 'invoice' | 'other'
        photo_url: uploadedUrl,
        storage_path: null,
        mime_type: asset.type ?? null,
        byte_size: asset.fileSize ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        metadata: { originalName: asset.fileName ?? null },
      });

      console.log('photoRes', photoRes);

      // 5) reflect downloadable url for the checkmark
      setDownloadUrl(section, index, uploadedUrl);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to upload image.');
      // Optionally clear slot on error
      // setSlotLocalUri(section, index, null);
    } finally {
      setUploading(section, index, false);
      setPickerTarget(null);
    }
  };

  const updateStatus = async () => {
    try {
      console.log('photos', invoiceImgs, otherImgs);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to update stop status.');
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-2 pt-4 pb-3 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            Stop Photos
          </Text>
          <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
            Step 3 of 3 — Invoice & additional photos
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-10`}>
        <Section
          title="Invoice Photos"
          subtitle="Add the invoice image(s) for this stop."
          data={invoiceImgs}
          uploading={invoiceUploading}
          urls={invoiceUrls}
          sectionKey="invoice"
          onAdd={() => pushSlot('invoice')}
          onRemove={index => removeSlot('invoice', index)}
          onPressEmpty={(idx, section) => openPickerFor(section, idx)}
        />

        <Section
          title="Additional Photos"
          subtitle="Optional reference/condition photos for the driver."
          data={otherImgs}
          uploading={otherUploading}
          urls={otherUrls}
          sectionKey="other"
          onAdd={() => pushSlot('other')}
          onRemove={index => removeSlot('other', index)}
          onPressEmpty={(idx, section) => openPickerFor(section, idx)}
        />

        <TouchableOpacity
          onPress={updateStatus}
          style={[
            tw`mt-2 px-4 py-3 rounded-2xl items-center`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Picker modal (camera or gallery) */}
      <Modal
        animationType="fade"
        transparent
        visible={pickerTarget != null}
        onRequestClose={() => setPickerTarget(null)}
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
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <CloseIcon width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handlePick('camera')}
              style={[
                tw`px-4 py-3 rounded-2xl mb-2 flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <Camera width={18} height={18} color={colors.text} />
              <Text style={[tw`ml-2`, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePick('gallery')}
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
    </View>
  );
}

/* ───────────────────── Section ───────────────────── */

const Section = ({
  title,
  subtitle,
  data,
  uploading,
  urls,
  onPressEmpty,
  onAdd,
  onRemove,
  sectionKey,
}: {
  title: string;
  subtitle: string;
  data: LocalImg[];
  uploading: boolean[];
  urls: (string | null)[];
  onPressEmpty: (index: number, section: PhotoCategory) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  sectionKey: PhotoCategory;
}) => {
  const { colors } = useTheme();

  return (
    <View style={tw`mb-6`}>
      <Text style={[tw`text-base font-semibold mb-1`, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[tw`text-2xs mb-2`, { color: colors.muted }]}>
        {subtitle}
      </Text>

      <View style={tw`flex-row flex-wrap`}>
        {data.map((item, idx) => {
          const isUploading = uploading[idx] === true;
          const hasUrl = urls[idx] != null;

          return (
            <View
              key={`${sectionKey}-${idx}`}
              style={[
                tw`mr-2 mb-2 rounded-xl overflow-hidden`,
                { width: 112, height: 112, backgroundColor: colors.border },
              ]}
            >
              {item.file.url ? (
                <>
                  <Image
                    source={{ uri: item.file.uri }}
                    style={{
                      width: '100%',
                      height: '100%',
                      opacity: isUploading ? 0.6 : 1,
                    }}
                    resizeMode="cover"
                  />

                  {/* Top-right delete */}
                  <TouchableOpacity
                    onPress={() => onRemove(idx)}
                    style={[
                      tw`absolute right-1 top-1 rounded-full p-1`,
                      { backgroundColor: 'rgba(0,0,0,0.5)' },
                    ]}
                  >
                    <Trash2 width={14} height={14} color="#fff" />
                  </TouchableOpacity>

                  {/* Uploading overlay */}
                  {isUploading && (
                    <View
                      style={[
                        tw`absolute left-0 right-0 top-0 bottom-0 items-center justify-center`,
                        { backgroundColor: 'rgba(0,0,0,0.25)' },
                      ]}
                    >
                      <ActivityIndicator />
                      <Text style={[tw`text-2xs mt-1`, { color: '#fff' }]}>
                        Uploading…
                      </Text>
                    </View>
                  )}

                  {/* Check when URL is set */}
                  {hasUrl && !isUploading && (
                    <View
                      style={[
                        tw`absolute left-1 bottom-1 p-1.5 rounded-full`,
                        { backgroundColor: 'rgba(0,0,0,0.5)' },
                      ]}
                    >
                      <Check width={14} height={14} color="#fff" />
                    </View>
                  )}
                </>
              ) : (
                // Empty slot → tap to choose (we pass the section so the screen can set category)
                <TouchableOpacity
                  onPress={() => onPressEmpty(idx, sectionKey)}
                  style={tw`flex-1 items-center justify-center`}
                >
                  <ImageIcon width={20} height={20} color={colors.muted} />
                  <Text style={[tw`text-2xs mt-1`, { color: colors.muted }]}>
                    Tap to add
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Add new empty slot */}
        <TouchableOpacity
          onPress={onAdd}
          style={[
            tw`mr-2 mb-2 rounded-xl items-center justify-center border border-dashed`,
            { width: 112, height: 112, borderColor: colors.muted },
          ]}
        >
          <Plus width={18} height={18} color={colors.muted} />
          <Text style={[tw`text-2xs mt-1`, { color: colors.muted }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
