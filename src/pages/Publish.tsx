import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, ArrowRight, ArrowLeft, CheckCircle2, X, Loader2, AlertCircle, ImageOff, Lock, Clock, Save, DollarSign, TrendingUp, Info } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { useAuth, db } from '@/src/lib/firebase';
import { getDoc, doc, getDocs, collection, query, where } from 'firebase/firestore';
import { isTrialUser, isTrialExpired, getTrialDaysRemaining, getTrialEndDate, TRIAL_MAX_LISTINGS } from '@/src/lib/trial';
import { createVehicle, updateVehiclePhotos, getVehicleById, updateVehicleDetailed } from '@/src/lib/vehicles';
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, COLORS } from '@/src/data/vehicle-catalog';
import { useGeoRef } from '@/src/hooks/useGeoRef';
import { useArgAutos } from '@/src/hooks/useArgAutos';
import type { FuelType, BodyType, Transmission, VehicleCondition } from '@/src/types';
import { usePhotoUpload } from '@/src/hooks/usePhotoUpload';
import { StepEstadoTecnico } from '@/src/components/publish/StepEstadoTecnico';
import { StepPreview } from '@/src/components/publish/StepPreview';
import {
  formatArgentineNumber, parseArgentineNumber,
  validateStep, getFirebaseErrorMessage, hasInspectionData,
  INITIAL_INSPECTION, INITIAL_FORM,
  type PublishFormData, type InspectionFormData,
} from '@/src/lib/publish-helpers';

const TOTAL_STEPS = 7;
const STEP_LABELS = ['Datos', 'Fotos', 'Legal', 'Estado', 'Cotización', 'Precio', 'Preview'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1989 }, (_, i) => String(currentYear + 1 - i));

export function Publish() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PublishFormData>(INITIAL_FORM);
  const [inspection, setInspection] = useState<InspectionFormData>(INITIAL_INSPECTION);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showNoPhotosDialog, setShowNoPhotosDialog] = useState(false);
  const [activeListingCount, setActiveListingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const photoUpload = usePhotoUpload();
  const { provincias, localidades, loadingProvincias, loadingLocalidades } = useGeoRef(formData.province);
  const { brands, models, versions, valuations, loadingBrands, loadingModels, loadingVersions } = useArgAutos(formData.brand, formData.model, formData.version);

  // Load existing vehicle data if editing
  useEffect(() => {
    if (!editId || !user) return;
    
    const loadVehicle = async () => {
      setLoadingEdit(true);
      try {
        const vehicle = await getVehicleById(editId);
        if (vehicle && vehicle.sellerId === user.uid) {
          setIsEditMode(true);
          setFormData({
            brand: vehicle.brand || '',
            model: vehicle.model || '',
            version: vehicle.version || '',
            year: String(vehicle.year || ''),
            km: String(vehicle.km || ''),
            condition: vehicle.condition || 'USADO',
            fuelType: vehicle.fuelType || '',
            transmission: vehicle.transmission || '',
            bodyType: vehicle.bodyType || '',
            color: vehicle.color || '',
            province: vehicle.province || '',
            city: vehicle.city || '',
            price: String(vehicle.price || ''),
            currency: vehicle.currency || 'ARS',
            description: vehicle.description || '',
            hasVTV: vehicle.hasVTV || false,
            hasPatenteAlDay: vehicle.hasPatenteAlDay || false,
            uniqueOwner: vehicle.uniqueOwner || false,
            officialService: vehicle.officialService || false,
            gncObleaVigente: vehicle.gncObleaVigente || false,
          });
          const inspData = vehicle.inspectionData || vehicle.inspection;
          if (inspData) {
            setInspection(inspData as InspectionFormData);
          }
          if (vehicle.photos) {
            setExistingPhotos(vehicle.photos);
            setPhotoPreviews(vehicle.photos);
          }
        }
      } catch (err) {
        console.error('Error loading vehicle for edit:', err);
      } finally {
        setLoadingEdit(false);
      }
    };
    loadVehicle();
  }, [editId, user]);

  const update = useCallback(<K extends keyof PublishFormData>(field: K, value: PublishFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const handleBrandSelect = (brandName: string) => {
    setFormData(prev => ({ ...prev, brand: brandName, model: '', version: '', bodyType: '' }));
    setError(null);
  };

  const handleModelSelect = (modelName: string) => {
    setFormData(prev => ({
      ...prev,
      model: modelName,
      version: ''
    }));
    setError(null);
  };

  const handleVersionSelect = (versionName: string) => {
    setFormData(prev => ({
      ...prev,
      version: versionName
    }));
    setError(null);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = 15 - photos.length;
    const newFiles = Array.from(files).slice(0, remaining);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...newFiles]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const nextStep = () => {
    if (step === 2 && photos.length === 0) {
      setShowNoPhotosDialog(true);
      return;
    }
    const err = validateStep(step, formData, photos);
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
  };

  const confirmNoPhotos = () => {
    setShowNoPhotosDialog(false);
    setError(null);
    setStep(s => s + 1);
  };

  const prevStep = () => { setError(null); setStep(s => s - 1); };

  const handleSubmit = async () => {
    if (!user) { setError('Debés iniciar sesión para publicar'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const cityName = localidades.find(l => l.id === formData.city)?.nombre || formData.city || '';
      const provinceName = provincias.find(p => p.id === formData.province)?.nombre || formData.province || '';
      const location = cityName ? `${cityName}, ${provinceName}` : provinceName;
      const kmRaw = parseArgentineNumber(formData.km);
      const priceRaw = parseArgentineNumber(formData.price);

      const inspData = hasInspectionData(inspection) ? inspection : undefined;

      const vehicleData: any = {
        sellerId: user.uid,
        sellerName: userProfile?.companyName || userProfile?.name || user.displayName || 'Agencia',
        sellerCompany: userProfile?.companyName || 'Agencia',
        brand: formData.brand,
        model: formData.model,
        version: formData.version,
        year: Number(formData.year),
        km: formData.condition === '0KM' ? 0 : Number(kmRaw),
        fuelType: formData.fuelType as FuelType,
        bodyType: (formData.bodyType || undefined) as BodyType | undefined,
        transmission: (formData.transmission || undefined) as Transmission | undefined,
        color: formData.color || undefined,
        condition: formData.condition as VehicleCondition,
        location,
        province: formData.province || undefined,
        city: cityName || undefined,
        price: priceRaw ? Number(priceRaw) : undefined,
        currency: formData.currency,
        priceNegotiable: false,
        status: 'ACTIVE',
        isFeatured: false,
        isInspected: false,
        description: formData.description,
        hasVTV: formData.hasVTV,
        hasPatenteAlDay: formData.hasPatenteAlDay,
        uniqueOwner: formData.uniqueOwner,
        officialService: formData.officialService,
        gncObleaVigente: formData.gncObleaVigente,
        inspectionData: inspData as any,
      };

      let vId = editId || '';

      if (isEditMode && editId) {
        await updateVehicleDetailed(editId, vehicleData);
      } else {
        vId = await createVehicle({
          ...vehicleData,
          photos: [],
        });
      }

      if (photos.length > 0) {
        try {
          const urls = await photoUpload.uploadPhotos(photos, vId, user.uid);
          await updateVehiclePhotos(vId, urls);
        } catch (uploadErr: unknown) {
          setError(`Vehículo ${isEditMode ? 'actualizado' : 'publicado'}, pero hubo un error al subir las fotos: ${getFirebaseErrorMessage(uploadErr)}`);
          setSubmitting(false);
          return;
        }
      }

      navigate('/marketplace');
    } catch (e: unknown) {
      console.error('Publish error:', e);
      setError(getFirebaseErrorMessage(e));
      setSubmitting(false);
    }
  };

  const trialExpired   = isTrialExpired(userProfile);
  const trialUser      = isTrialUser(userProfile);
  const trialDaysLeft  = getTrialDaysRemaining(userProfile);
  const trialEndDate   = getTrialEndDate(userProfile);
  const atTrialLimit   = trialUser && !trialExpired && activeListingCount >= TRIAL_MAX_LISTINGS;

  if (loadingEdit) {
    return (
      <div className="container mx-auto py-40 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="font-bold uppercase tracking-widest text-xs">Cargando publicación...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-20 px-4">
      <div className="mb-12 text-center space-y-4">
        <Badge className="bg-primary/20 text-primary border-primary/20 font-bold tracking-tighter px-4 py-1.5 rounded-full text-sm">
          {isEditMode ? 'EDITAR PUBLICACIÓN' : 'NUEVA PUBLICACIÓN'}
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase">
          {isEditMode ? 'Modificar Unidad' : 'Sumar Stock'}
        </h1>
        <p className="text-muted-foreground font-medium">
          {isEditMode ? 'Actualizá la información de tu vehículo.' : 'Completá los pasos para publicar tu unidad en la comunidad.'}
        </p>
      </div>

      {trialExpired && (
        <Card className="border-red-500/20 bg-card backdrop-blur-xl shadow-2xl rounded-[3.5rem] overflow-hidden">
          <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <Lock className="h-10 w-10 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tighter uppercase">Período de prueba vencido</h2>
              <p className="text-muted-foreground font-medium max-w-md">
                Tu prueba gratuita de 60 días finalizó el{' '}
                <span className="text-foreground font-bold">
                  {trialEndDate?.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>.
              </p>
              <p className="text-muted-foreground font-medium max-w-md">
                Tus publicaciones fueron pausadas automáticamente. Activá tu plan para volver a publicar y dar visibilidad a tu stock.
              </p>
            </div>
            <Button
              onClick={() => navigate('/')}
              className="rounded-full px-10 h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              Ver planes
            </Button>
          </CardContent>
        </Card>
      )}

      {!trialExpired && atTrialLimit && (
        <Card className="border-yellow-500/20 bg-card backdrop-blur-xl shadow-2xl rounded-[3.5rem] overflow-hidden">
          <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-10 w-10 text-yellow-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tighter uppercase">Límite de prueba alcanzado</h2>
              <p className="text-muted-foreground font-medium max-w-md">
                Tu período de prueba permite un máximo de <span className="text-foreground font-bold">{TRIAL_MAX_LISTINGS} publicaciones activas</span> simultáneas.
              </p>
              <p className="text-muted-foreground font-medium max-w-md">
                Pausá una publicación existente para liberar un espacio, o activá tu plan para publicar sin límites.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/profile')} className="rounded-full px-8 h-12 font-bold uppercase tracking-widest border-border">
                Gestionar stock
              </Button>
              <Button onClick={() => navigate('/')} className="rounded-full px-8 h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                Ver planes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!trialExpired && !atTrialLimit && (
        <>
          {trialUser && (
            <div className="mb-8 flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-bold">
                  Período de prueba — {activeListingCount}/{TRIAL_MAX_LISTINGS} publicaciones activas
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="flex justify-between mb-12 relative max-w-lg mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-border -translate-y-1/2 z-0 rounded-full" />
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`relative z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border-4 transition-all duration-500 ${
                  step >= s ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-background border-border text-muted-foreground'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 stroke-[3]" /> : <span className="font-bold text-sm">{s}</span>}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max text-[7px] md:text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                  {STEP_LABELS[s - 1]}
                </div>
              </div>
            ))}
          </div>

          <Card className="border-border bg-card backdrop-blur-xl shadow-2xl rounded-[3.5rem] overflow-hidden">
            <CardContent className="p-10">
              {error && (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {step === 1 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Marca</Label>
                      <Select value={formData.brand} onValueChange={handleBrandSelect} disabled={loadingBrands}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder={loadingBrands ? "Cargando..." : "Seleccionar marca"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {brands.map(b => (
                            <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Modelo</Label>
                      <Select value={formData.model} onValueChange={handleModelSelect} disabled={!formData.brand || loadingModels}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder={loadingModels ? "Cargando..." : "Seleccionar modelo"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {models.map(m => (
                            <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Versión</Label>
                      <Select value={formData.version} onValueChange={handleVersionSelect} disabled={!formData.model || loadingVersions}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder={loadingVersions ? "Cargando..." : "Seleccionar versión"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {versions.map(v => (
                            <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Año</Label>
                      <Select value={formData.year} onValueChange={v => update('year', v)}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder="Seleccionar año" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {YEARS.map(y => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Kilometraje</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatArgentineNumber(formData.km)}
                        onChange={e => update('km', parseArgentineNumber(e.target.value))}
                        placeholder="0"
                        className="h-14 rounded-xl bg-muted border-border font-bold"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Condición</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => update('condition', 'USADO')}
                          className={`h-14 rounded-xl font-bold uppercase tracking-widest transition-all ${formData.condition === 'USADO' ? 'bg-primary/15 border-primary text-primary shadow-md shadow-primary/20' : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:border-primary/30 hover:text-foreground'}`}
                        >
                          Usado
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => update('condition', '0KM')}
                          className={`h-14 rounded-xl font-bold uppercase tracking-widest transition-all ${formData.condition === '0KM' ? 'bg-primary/15 border-primary text-primary shadow-md shadow-primary/20' : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:border-primary/30 hover:text-foreground'}`}
                        >
                          0 KM
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Combustible</Label>
                      <Select value={formData.fuelType} onValueChange={v => update('fuelType', v)}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {FUEL_TYPES.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Transmisión</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {TRANSMISSIONS.map(t => (
                          <Button
                            key={t.value}
                            variant="outline"
                            type="button"
                            onClick={() => update('transmission', t.value)}
                            className={`h-14 rounded-xl font-bold uppercase tracking-widest transition-all ${formData.transmission === t.value ? 'bg-primary/15 border-primary text-primary shadow-md shadow-primary/20' : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:border-primary/30 hover:text-foreground'}`}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Carrocería</Label>
                      <Select value={formData.bodyType} onValueChange={v => update('bodyType', v)}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {BODY_TYPES.map(b => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Color</Label>
                      <Select value={formData.color} onValueChange={v => update('color', v)}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {COLORS.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full border border-border" style={{ background: c.hex }} />
                                {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Provincia</Label>
                        {userProfile?.province && (
                          <span className="text-[8px] font-bold text-primary uppercase">Vinculado a tu Agencia</span>
                        )}
                      </div>
                      <Select 
                        value={formData.province} 
                        onValueChange={v => { update('province', v); update('city', ''); }}
                        disabled={!!userProfile?.province || loadingProvincias}
                      >
                        <SelectTrigger className={`h-14 rounded-xl bg-muted border-border font-bold ${userProfile?.province ? 'opacity-70' : ''}`}>
                          <SelectValue>
                            {loadingProvincias ? 'Cargando provincias...' : (provincias.find(p => p.id === formData.province)?.nombre || 'Seleccionar provincia')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {provincias.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Localidad</Label>
                        {userProfile?.city && (
                          <span className="text-[8px] font-bold text-primary uppercase">Vinculado a tu Agencia</span>
                        )}
                      </div>
                      <Select
                        value={formData.city}
                        onValueChange={v => update('city', v)}
                        disabled={!formData.province || !!userProfile?.city || loadingLocalidades}
                      >
                        <SelectTrigger className={`h-14 rounded-xl bg-muted border-border font-bold ${userProfile?.city ? 'opacity-70' : ''}`}>
                          <SelectValue>
                            {loadingLocalidades ? 'Cargando localidades...' : (localidades.find(l => l.id === formData.city)?.nombre || (formData.province ? 'Seleccionar localidad' : 'Primero elegí provincia'))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                          {localidades.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={nextStep} className="h-14 px-10 rounded-full font-black uppercase italic tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => addPhotos(e.target.files)}
                  />

                  <div
                    className={`border-4 border-dashed rounded-[2rem] p-12 text-center space-y-6 cursor-pointer transition-all group ${
                      isDragging ? 'border-primary/60 bg-primary/5' : 'border-border bg-muted hover:border-primary/30'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); addPhotos(e.dataTransfer.files); }}
                  >
                    <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                      <Camera className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-bold tracking-tighter uppercase">Subir fotografías</p>
                      <p className="text-sm text-muted-foreground font-medium">
                        {photos.length === 0
                          ? 'Arrastrá tus fotos aquí o hacé clic para buscar (Máx 15)'
                          : `${photos.length}/15 fotos seleccionadas — hacé clic para agregar más`}
                      </p>
                    </div>
                    {photos.length < 15 && (
                      <Button variant="outline" className="rounded-full px-8 border-border font-bold uppercase tracking-widest text-xs" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        Seleccionar archivos
                      </Button>
                    )}
                  </div>

                  {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {photoPreviews.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                          <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                          {i === 0 && (
                            <div className="absolute bottom-1 left-1 bg-primary/90 text-primary-foreground text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                              Principal
                            </div>
                          )}
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showNoPhotosDialog && (
                    <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                      <div className="flex items-center gap-3">
                        <ImageOff className="h-5 w-5 text-amber-500" />
                        <p className="text-sm font-bold uppercase tracking-widest">¿Publicar sin fotos?</p>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">Las publicaciones sin fotos tienen mucha menos visibilidad. ¿Estás seguro?</p>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setShowNoPhotosDialog(false)} className="rounded-full px-6 border-border font-bold uppercase tracking-widest text-xs">
                          Volver
                        </Button>
                        <Button onClick={confirmNoPhotos} className="rounded-full px-6 font-bold uppercase tracking-widest text-xs bg-amber-500 hover:bg-amber-600">
                          Continuar sin fotos
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button onClick={nextStep} className="w-full sm:w-auto h-14 px-10 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <h3 className="text-xl font-bold tracking-tighter uppercase">Documentación y Estado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'hasVTV', label: 'VTV Vigente' },
                      { id: 'hasPatenteAlDay', label: 'Patente al día' },
                      { id: 'uniqueOwner', label: 'Único Dueño' },
                      { id: 'officialService', label: 'Services Oficiales' },
                      { id: 'gncObleaVigente', label: 'Oblea GNC Vigente' },
                    ].map(({ id, label }) => (
                      <label
                        key={id}
                        htmlFor={id}
                        className="flex items-center space-x-3 border border-border bg-muted/30 p-6 rounded-xl hover:border-primary/30 transition-all cursor-pointer"
                      >
                        <Checkbox
                          id={id}
                          className="h-6 w-6 rounded-md border-white/20"
                          checked={formData[id as keyof PublishFormData] as boolean}
                          onCheckedChange={v => update(id as keyof PublishFormData, Boolean(v) as any)}
                        />
                        <span className="font-bold uppercase tracking-widest text-xs">{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Observaciones / Detalles estéticos</Label>
                    <Textarea
                      value={formData.description}
                      onChange={e => update('description', e.target.value)}
                      placeholder="Describí el estado general, equipamiento adicional, etc."
                      className="min-h-[150px] rounded-xl bg-muted border-border font-bold p-6"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button onClick={nextStep} className="w-full sm:w-auto h-14 px-10 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <StepEstadoTecnico inspection={inspection} onChange={setInspection} />
                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button onClick={nextStep} className="w-full sm:w-auto h-14 px-10 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <div className="text-center space-y-3">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tighter uppercase">Cotización ACARA</h3>
                    <p className="text-sm text-muted-foreground font-medium max-w-md mx-auto">
                      Valores de referencia del mercado para la versión seleccionada según ACARA (Asociación de Concesionarios de Automotores).
                    </p>
                  </div>

                  {valuations.length > 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border overflow-hidden">
                        <div className="grid grid-cols-3 bg-muted/50 px-6 py-3 border-b border-border">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Año</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Valor ACARA</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Moneda</span>
                        </div>
                        {valuations.map((val) => (
                          <div
                            key={val.id}
                            className={`grid grid-cols-3 px-6 py-4 border-b border-border last:border-b-0 transition-colors ${
                              val.year.toString() === formData.year
                                ? 'bg-primary/5 border-l-4 border-l-primary'
                                : 'hover:bg-muted/30'
                            }`}
                          >
                            <span className={`font-bold tracking-tighter ${
                              val.year.toString() === formData.year ? 'text-primary' : ''
                            }`}>
                              {val.year}
                              {val.year.toString() === formData.year && (
                                <Badge className="ml-2 bg-primary/15 text-primary border-none text-[8px] font-black px-2 py-0 rounded-full">TU AÑO</Badge>
                              )}
                            </span>
                            <span className="font-bold text-right tracking-tighter text-lg">
                              $ {val.acara_price ? formatArgentineNumber(val.acara_price) : formatArgentineNumber(val.price)}
                            </span>
                            <span className="text-right text-xs font-bold text-muted-foreground uppercase">
                              {val.currency || 'ARS'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                          Estos valores son referenciales del mercado argentino. El precio final lo definís vos en el próximo paso.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 rounded-2xl bg-muted/30 border border-border">
                      <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center">
                        <DollarSign className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-2 max-w-sm">
                        <p className="font-bold uppercase tracking-tighter">Sin cotización ACARA disponible</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {!formData.version
                            ? 'Seleccioná una versión en el paso 1 para consultar cotizaciones.'
                            : 'Esta versión aún no cuenta con cotización de ACARA. Podés definir tu precio manualmente en el siguiente paso.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button onClick={nextStep} className="w-full sm:w-auto h-14 px-10 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <h3 className="text-xl font-bold tracking-tighter uppercase">Precio y Condiciones de Venta</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Moneda</Label>
                      <Select value={formData.currency} onValueChange={v => update('currency', v as 'USD' | 'ARS')}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted border-border font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                          <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Precio</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">
                          {formData.currency === 'USD' ? 'U$D' : '$'}
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatArgentineNumber(formData.price)}
                          onChange={e => update('price', parseArgentineNumber(e.target.value))}
                          placeholder="0"
                          className="h-14 rounded-xl bg-muted border-border font-bold text-2xl text-primary tracking-tighter pl-14"
                        />
                      </div>
                      {valuations.find(v => v.year.toString() === formData.year) && (
                        <p className="text-[10px] font-medium text-muted-foreground ml-2">
                          Valor estimado: ARS ${formatArgentineNumber(valuations.find(v => v.year.toString() === formData.year)?.price || '')}
                          <br/>
                          <span className="text-[8px] opacity-60 uppercase tracking-widest">Cotización en tiempo real según ACARA</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button onClick={nextStep} className="w-full sm:w-auto h-14 px-10 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 shadow-lg shadow-primary/20">
                      Siguiente <ArrowRight className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 7 && (
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                  <StepPreview 
                    formData={formData} 
                    inspection={inspection} 
                    photoPreviews={photoPreviews} 
                    photosCount={photos.length} 
                    locationStr={localidades.find(l => l.id === formData.city)?.nombre ? `${localidades.find(l => l.id === formData.city)?.nombre}, ${provincias.find(p => p.id === formData.province)?.nombre || formData.province}` : (provincias.find(p => p.id === formData.province)?.nombre || formData.province || '')}
                  />

                  {photoUpload.isUploading && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                        <span>Subiendo fotos...</span>
                        <span>{photoUpload.completedFiles}/{photoUpload.totalFiles}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${photoUpload.overallProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button variant="ghost" onClick={prevStep} disabled={submitting} className="w-full sm:w-auto h-14 px-8 rounded-full font-bold uppercase tracking-tighter text-lg gap-2 hover:bg-muted">
                      <ArrowLeft className="h-5 w-5 stroke-[3]" /> Anterior
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full sm:w-auto h-14 px-12 rounded-full font-black uppercase italic tracking-tighter text-xl gap-2 shadow-xl shadow-primary/40 bg-primary text-primary-foreground hover:scale-105 transition-all"
                    >
                      {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Publicar Unidad <CheckCircle2 className="h-6 w-6 stroke-[3]" /></>}
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
