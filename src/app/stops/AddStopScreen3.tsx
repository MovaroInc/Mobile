import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  Trash2,
  Image as ImageIcon,
  Plus,
  Camera,
  X,
} from 'react-native-feather';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  takePhotoWithCamera,
  uploadImage,
} from '../../shared/lib/ImageHelpers';
import { pickImageFromGallery } from '../../shared/lib/ImageHelpers';
import tailwind from 'twrnc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createStop,
  createStopsPayments,
  createStopsPhotos,
  createStopsRequirements,
  updateStop,
} from '../../shared/lib/StopsHelpers';
import { useSession } from '../../state/useSession';
type imageItem = {
  public_url: string;
  file: any;
  loading: boolean;
  localUrl: string;
};

const AddStopScreen3 = () => {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { colors } = useTheme();
  const { profile, business } = useSession();
  const { routeId, stopsCount } = params as RouteParams;

  const [invoiceImages, setInvoiceImages] = useState<imageItem[]>([]);
  const [otherImages, setOtherImages] = useState<imageItem[]>([]);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);

  const [showImageTypePicker, setShowImageTypePicker] =
    useState<boolean>(false);

  const [selectedCategory, setSelectedCategory] = useState<'invoice' | 'other'>(
    'invoice',
  );

  const openSelectedPicker = (category: 'invoice' | 'other', index: number) => {
    setSelectedCategory(category);
    setSelectedIndex(index);
    console.log('selectedIndex', index);
    setShowImageTypePicker(true);
  };

  const addSlot = (category: 'invoice' | 'other') => {
    if (category === 'invoice') {
      setInvoiceImages(prev => [
        ...prev,
        { public_url: null, file: null, loading: false, localUrl: null },
      ]);
    } else {
      setOtherImages(prev => [
        ...prev,
        { public_url: null, file: null, loading: false, localUrl: null },
      ]);
    }
  };

  const removeSlt = (category: 'invoice' | 'other', index: number) => {
    if (category === 'invoice') {
      setInvoiceImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setOtherImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadImageToStorage = async (
    localUri: string,
    originalFileName: string,
  ) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: originalFileName || 'photo.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await uploadImage(formData);

      return res.success ? res.url : null;
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const ImageSelector = async (source: 'camera' | 'gallery') => {
    if (!selectedCategory) return;

    try {
      const asset =
        source === 'camera'
          ? await takePhotoWithCamera()
          : await pickImageFromGallery();
      console.log('asset', asset);
      console.log('selectedIndex', selectedIndex);
      const url = await uploadImageToStorage(asset.uri, asset.fileName);
      if (selectedCategory === 'invoice') {
        setInvoiceImages(prev => {
          const newImages = [...prev];
          newImages[selectedIndex] = {
            ...newImages[selectedIndex],
            file: asset,
            public_url: url,
          };
          return newImages;
        });
      } else {
        setOtherImages(prev => {
          const newImages = [...prev];
          newImages[selectedIndex] = {
            ...newImages[selectedIndex],
            file: asset,
            public_url: url,
          };
          return newImages;
        });
      }
      setShowImageTypePicker(false);
    } catch (e) {
      console.error('Error picking image:', e);
    }
  };

  useEffect(() => {
    console.log('invoiceImages', invoiceImages);
    console.log('otherImages', otherImages);
  }, [invoiceImages, otherImages]);

  const handleSubmit = async () => {
    const stored1Payload = await AsyncStorage.getItem('step1Payload');
    const payload1 = JSON.parse(stored1Payload || '{}');
    const stored2Payload = await AsyncStorage.getItem('step2Payload');
    const payload2 = JSON.parse(stored2Payload || '{}');
    const reqPayloads = {
      route_id: routeId,
      business_id: business?.id,
      stop_type: payload1.stop_type,
      depot_role: payload1.depot_role,
      customer_id: payload1.customer_id,
      vendor_id: payload1.vendor_id,
      address_line1: payload1.address_line1,
      address_line2: payload1.address_line2,
      city: payload1.city,
      region: payload1.region,
      postal_code: payload1.postal_code,
      country_code: payload1.country_code,
      latitude: payload1.latitude,
      longitude: payload1.longitude,
      status: 'scheduled',
      contact_name: payload1.contact_name,
      contact_phone: payload1.contact_phone,
      contact_email: payload1.contact_email,
      business_name: payload1.business_name,
      sequence: stopsCount + 1,
    };
    const resStop = await createStop(reqPayloads);
    console.log('resStop', resStop.data);
    const stopId = resStop.data.id;
    const r = payload2?.requirements || payload2?.stop_requirements || null;
    if (r) {
      const reqPayload = {
        business_id: business.id,
        stop_id: stopId,

        // canonical + fallbacks for typos/alt names
        give_invoice: !!r.give_invoice,
        print_name: !!r.print_name,
        contactless: !!r.contactless,
        contact_before: !!r.contact_before,

        signature: !!(r.signature_required ?? r.signature),
        require_photo_products: !!(
          r.require_photo_products ?? r.photos_required
        ),
        require_photo_invoice: !!(r.require_photo_invoice ?? r.photos_required),
        checlist_required: !!(r.checklist_required ?? r.checlist_required),
        two_person: !!(r.two_person_required ?? r.two_person),
        lift_gate_required: !!(r.liftgate_needed ?? r.lift_gate_required),
        id_required: !!(r.id_check ?? r.id_required),
        temp_control: !!(r.temperature_control ?? r.temp_control),
        dock_appointment: !!r.dock_appointment,

        access_code: r.access_code ?? null,
        access_info: r.access_info ?? null,
        notes: r.notes ?? null,
      };

      const resStopRequirements = await createStopsRequirements(reqPayload);
      console.log('resStopRequirements', resStopRequirements);
    }

    const pay = payload2?.payment;
    if (pay) {
      const resPay = await createStopsPayments({
        route_id: routeId,
        business_id: business.id,
        stop_id: stopId,
        currency: 'USD',
        amount_due: Number(pay.amount) || 0,
        method: pay.method,
        reference_number: pay.reference ?? null,
        status: 'pending',
        notes: pay.notes ?? null,
      });
      console.log('resPay', resPay);
    }

    if (invoiceImages.length > 0) {
      invoiceImages.forEach(async (img, idx) => {
        const resInvoice = await createStopsPhotos({
          stop_id: stopId,
          business_id: business.id,
          uploaded_by: profile.id,
          photo_category: 'invoice',
          photo_url: img.public_url,
          storage_path: img.file.uri,
          mime_type: img.file.type,
          byte_size: img.file.size,
          width: img.file.width,
          height: img.file.height,
        });
        console.log('resInvoice', resInvoice);
      });
    }
    if (otherImages.length > 0) {
      otherImages.forEach(async (img, idx) => {
        const resInvoice = await createStopsPhotos({
          stop_id: stopId,
          business_id: business.id,
          uploaded_by: profile.id,
          photo_category: 'other',
          photo_url: img.public_url,
          storage_path: img.file.uri,
          mime_type: img.file.type,
          byte_size: img.file.size,
          width: img.file.width,
          height: img.file.height,
        });
        console.log('resInvoice', resInvoice);
      });
    }
    await AsyncStorage.removeItem('step1Payload');
    await AsyncStorage.removeItem('step2Payload');
    nav.pop(3);
  };

  return (
    <View style={[tailwind`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tailwind`px-2 pt-4 pb-3 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tailwind`pl-2`}>
          <Text style={[tailwind`text-2xl font-bold`, { color: colors.text }]}>
            Stop Photos
          </Text>
          <Text style={[tailwind`text-2xs mt-0.5`, { color: colors.muted }]}>
            Step 3 of 3 — Invoice & additional photos
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={tailwind`px-4 pb-10`}>
        <Section
          title="Invoice Photos"
          subtitle="Add the invoice image(s) for this stop."
          data={invoiceImages}
          sectionKey="invoice"
          onAdd={openSelectedPicker}
          onRemove={removeSlt}
          onPressEmpty={addSlot}
        />
        <Section
          title="Other Photos"
          subtitle="Add any additional photos for this stop."
          data={otherImages}
          sectionKey="other"
          onAdd={openSelectedPicker}
          onRemove={removeSlt}
          onPressEmpty={addSlot}
        />
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={showImageTypePicker}
        onRequestClose={() => setShowImageTypePicker(false)}
      >
        <View style={tailwind`flex-1 bg-black/40`}>
          <View
            style={[
              tailwind`mt-auto rounded-t-3xl p-4 pb-12`,
              { backgroundColor: colors.main },
            ]}
          >
            <View style={tailwind`flex-row items-center mb-3`}>
              <Text
                style={[
                  tailwind`text-xl font-semibold`,
                  { color: colors.text },
                ]}
              >
                Add Photo
              </Text>
              <View style={tailwind`flex-1`} />
              <TouchableOpacity onPress={() => setShowImageTypePicker(false)}>
                <X width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => ImageSelector('camera')}
              style={[
                tailwind`px-4 py-3 rounded-2xl mb-2 flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <Camera width={18} height={18} color={colors.text} />
              <Text style={[tailwind`ml-2`, { color: colors.text }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => ImageSelector('gallery')}
              style={[
                tailwind`px-4 py-3 rounded-2xl flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <ImageIcon width={18} height={18} color={colors.text} />
              <Text style={[tailwind`ml-2`, { color: colors.text }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <TouchableOpacity
        onPress={handleSubmit}
        style={[
          tailwind`mt-2 px-4 py-3 rounded-2xl items-center`,
          { backgroundColor: colors.brand?.primary || '#2563eb' },
        ]}
      >
        <Text
          style={[tailwind`text-white font-semibold`, { color: colors.text }]}
        >
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default AddStopScreen3;

const Section = ({
  title,
  subtitle,
  data,
  onPressEmpty,
  onAdd,
  onRemove,
  sectionKey,
}: {
  title: string;
  subtitle: string;
  data: imageItem[];
  onPressEmpty: (section: 'invoice' | 'other') => void;
  onAdd: (category: 'invoice' | 'other', index: number) => void;
  onRemove: (category: 'invoice' | 'other', index: number) => void;
  sectionKey: 'invoice' | 'other';
}) => {
  const { colors } = useTheme();

  return (
    <View style={tailwind`mb-6`}>
      <Text
        style={[tailwind`text-base font-semibold mb-1`, { color: colors.text }]}
      >
        {title}
      </Text>
      <Text style={[tailwind`text-2xs mb-2`, { color: colors.muted }]}>
        {subtitle}
      </Text>

      <View style={tailwind`flex-row flex-wrap`}>
        {data.map((item, idx) => {
          const isUploading = item.loading;
          const hasUrl = item.public_url != null;

          return (
            <View
              key={`${sectionKey}-${idx}`}
              style={[
                tailwind`mr-2 mb-2 rounded-xl overflow-hidden`,
                { width: 112, height: 112, backgroundColor: colors.border },
              ]}
            >
              {item.file ? (
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
                    onPress={() => onRemove(sectionKey, idx)}
                    style={[
                      tailwind`absolute right-1 top-1 rounded-full p-1`,
                      { backgroundColor: 'rgba(0,0,0,0.5)' },
                    ]}
                  >
                    <Trash2 width={14} height={14} color="#fff" />
                  </TouchableOpacity>

                  {/* Uploading overlay */}
                  {isUploading && (
                    <View
                      style={[
                        tailwind`absolute left-0 right-0 top-0 bottom-0 items-center justify-center`,
                        { backgroundColor: 'rgba(0,0,0,0.25)' },
                      ]}
                    >
                      <ActivityIndicator />
                      <Text
                        style={[tailwind`text-2xs mt-1`, { color: '#fff' }]}
                      >
                        Uploading…
                      </Text>
                    </View>
                  )}

                  {/* Check when URL is set */}
                  {hasUrl && !isUploading && (
                    <View
                      style={[
                        tailwind`absolute left-1 bottom-1 p-1.5 rounded-full`,
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
                  onPress={() => onAdd(sectionKey, idx)}
                  style={tailwind`flex-1 items-center justify-center`}
                >
                  <ImageIcon width={20} height={20} color={colors.muted} />
                  <Text
                    style={[tailwind`text-2xs mt-1`, { color: colors.muted }]}
                  >
                    Tap to add
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Add new empty slot */}
        <TouchableOpacity
          onPress={() => onPressEmpty(sectionKey)}
          style={[
            tailwind`mr-2 mb-2 rounded-xl items-center justify-center border border-dashed`,
            { width: 112, height: 112, borderColor: colors.muted },
          ]}
        >
          <Plus width={18} height={18} color={colors.muted} />
          <Text style={[tailwind`text-2xs mt-1`, { color: colors.muted }]}>
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
