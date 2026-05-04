import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Eye, MessageSquare, Clock, BarChart3, TrendingUp, Award,
  MapPin, Building2, Phone, Mail, Loader2, ShoppingBag, Plus, Settings,
  Save, Pause, Play, CheckCircle2, Package, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { motion } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getResponseBadge } from '@/src/lib/analytics';
import { useAuth, db } from '@/src/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getVehiclesBySeller, updateVehicleStatus, pauseAllSellerListings } from '@/src/lib/vehicles';
import { isTrialUser, isTrialExpired, getTrialDaysRemaining, getTrialEndDate, TRIAL_MAX_LISTINGS } from '@/src/lib/trial';
import { useGeoRef } from '@/src/hooks/useGeoRef';
import { getVehiclePath } from '@/src/lib/seo';
import type { Vehicle } from '../types';

function StatCard({ icon: Icon, label, value, accent = false }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`p-6 rounded-3xl border space-y-3 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}
    >
      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${accent ? 'bg-primary/10' : 'bg-muted'}`}>
        <Icon className={`h-5 w-5 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tighter">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

const STATUS_CONFIG = {
  ACTIVE:   { label: 'Activo',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  PAUSED:   { label: 'Pausado',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  SOLD:     { label: 'Vendido',  color: 'bg-primary/20 text-primary border-primary/30' },
  RESERVED: { label: 'Reservado',color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  DRAFT:    { label: 'Borrador', color: 'bg-muted text-muted-foreground border-border' },
} as const;

export function Profile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [allListings, setAllListings] = useState<Vehicle[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    company: '', province: '', city: '', phone: '', name: '', lastName: '',
  });

  const targetUid = uid || user?.uid;
  const isOwnProfile = !uid || uid === user?.uid;

  const { provincias, localidades, loadingProvincias, loadingLocalidades } = useGeoRef(isEditDialogOpen ? editForm.province : profileData?.province);

  useEffect(() => {
    async function fetchProfile() {
      if (!targetUid) return;
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUid));
        let data: any = null;
        if (userDoc.exists()) {
          data = userDoc.data();
          setProfileData(data);
          setEditForm({
            company: data.company || '',
            province: data.province || '',
            city: data.city || '',
            phone: data.phone || '',
            name: data.name || '',
            lastName: data.lastName || '',
          });
        }
        let vehicles = await getVehiclesBySeller(targetUid);
        // Auto-pause all active listings when trial has expired
        if (isOwnProfile && isTrialExpired(data) && vehicles.some(v => v.status === 'ACTIVE')) {
          await pauseAllSellerListings(targetUid);
          vehicles = vehicles.map(v => v.status === 'ACTIVE' ? { ...v, status: 'PAUSED' as Vehicle['status'] } : v);
        }
        setAllListings(vehicles);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [targetUid]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { ...editForm, updatedAt: new Date() });
      setProfileData((prev: any) => ({ ...prev, ...editForm }));
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (vehicle: Vehicle) => {
    const next = vehicle.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    if (next === 'ACTIVE' && isTrialExpired(profileData)) return;
    if (next === 'ACTIVE' && isTrialUser(profileData) && allListings.filter(v => v.status === 'ACTIVE').length >= TRIAL_MAX_LISTINGS) return;
    setTogglingId(vehicle.id);
    try {
      await updateVehicleStatus(vehicle.id, next);
      setAllListings(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: next } : v));
    } finally {
      setTogglingId(null);
    }
  };

  const handleMarkSold = async (vehicle: Vehicle) => {
    setMarkingSoldId(vehicle.id);
    try {
      await updateVehicleStatus(vehicle.id, 'SOLD');
      setAllListings(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'SOLD' } : v));
    } finally {
      setMarkingSoldId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Perfil no encontrado</h2>
        <Button onClick={() => navigate('/marketplace')}>Volver al Marketplace</Button>
      </div>
    );
  }

  const responseBadge = getResponseBadge(profileData.responseTimestamps || [12, 15, 8, 20]);
  const provinceName = provincias.find(p => p.id === profileData.province)?.nombre || profileData.province || 'No especificada';
  const cityName = localidades.find(l => l.id === profileData.city)?.nombre || profileData.city || '';

  const trialExpired     = isTrialExpired(profileData);
  const trialUserProfile = isTrialUser(profileData);
  const trialDaysLeft    = getTrialDaysRemaining(profileData);
  const trialEndDate     = getTrialEndDate(profileData);

  // Real metrics computed from actual vehicle data
  const activeListings  = allListings.filter(v => v.status === 'ACTIVE');
  const pausedListings  = allListings.filter(v => v.status === 'PAUSED');
  const soldListings    = allListings.filter(v => v.status === 'SOLD');
  const totalViews      = allListings.reduce((s, v) => s + (v.viewCount || 0), 0);
  const totalContacts   = allListings.reduce((s, v) => s + (v.contactCount || 0), 0);

  // For public profiles only show active listings
  const visibleListings = isOwnProfile ? allListings : activeListings;

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-muted">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
          {isOwnProfile && (
            <Badge className="bg-primary/10 text-primary border border-primary/20 font-bold tracking-widest text-[10px] px-4 py-1.5 rounded-full">
              MI CONCESIONARIA
            </Badge>
          )}
        </div>
        {/* Trial status banner */}
        {isOwnProfile && trialUserProfile && (
          <div className={`mb-10 p-5 rounded-2xl border flex items-center gap-4 ${trialExpired ? 'bg-red-500/5 border-red-500/20' : 'bg-primary/5 border-primary/20'}`}>
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${trialExpired ? 'bg-red-500/10' : 'bg-primary/10'}`}>
              {trialExpired ? <Lock className="h-5 w-5 text-red-400" /> : <Clock className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 space-y-0.5">
              {trialExpired ? (
                <>
                  <p className="font-bold uppercase tracking-widest text-sm text-red-400">Período de prueba vencido</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Tus publicaciones fueron pausadas el {trialEndDate?.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}. Activá tu plan para volver a publicar.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold uppercase tracking-widest text-sm text-primary">Período de prueba activo</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restantes · {activeListings.length}/{TRIAL_MAX_LISTINGS} publicaciones activas
                  </p>
                </>
              )}
            </div>
            {trialExpired && (
              <Button size="sm" onClick={() => navigate('/')} className="shrink-0 rounded-full h-9 px-5 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                Ver planes
              </Button>
            )}
          </div>
        )}
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-start gap-8 mb-16"
        >
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-2xl">
              <AvatarImage src={profileData.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-4xl">
                {profileData.name?.[0]}{profileData.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-card border border-border p-2 rounded-2xl shadow-xl">
              <Award className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase break-words">{profileData.name} {profileData.lastName}</h1>
              <Badge className="bg-primary text-primary-foreground font-black text-[10px] rounded-full px-4 py-1 shadow-lg shadow-primary/20 uppercase tracking-widest">
                {profileData.plan || 'Standard'}
              </Badge>
              <Badge className={`${responseBadge.color} text-white font-bold text-[10px] rounded-full px-4 py-1 uppercase tracking-widest`}>
                {responseBadge.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" /> {profileData.company || 'Agencia Independiente'}
              </span>
              <span className="flex items-center gap-2 font-bold text-foreground">
                <MapPin className="h-4 w-4 text-primary" /> {cityName}{cityName ? ', ' : ''}{provinceName}
              </span>
              <span className="flex items-center gap-2 font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Activo ahora
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 min-w-0">
              <span className="flex items-center gap-1.5 min-w-0"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{profileData.email}</span></span>
              <span className="flex items-center gap-1.5 shrink-0"><Phone className="h-3.5 w-3.5" /> {profileData.phone || 'No especificado'}</span>
            </div>

            {isOwnProfile && (
              <div className="pt-4 flex gap-3 w-full">
                <Button
                  onClick={() => setIsEditDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full font-bold uppercase tracking-wide text-[10px] gap-2 border-primary/20 hover:bg-primary/5 h-10"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" /> Configurar
                </Button>
                <Button
                  onClick={() => navigate('/publish')}
                  disabled={trialExpired}
                  size="sm"
                  className="flex-1 rounded-full font-bold uppercase tracking-wide text-[10px] gap-2 shadow-lg shadow-primary/20 h-10"
                >
                  {trialExpired ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                  {trialExpired ? 'Vencida' : 'Publicar'}
                </Button>
              </div>
            )}
          </div>

          {!isOwnProfile && (
            <Button
              size="lg"
              className="rounded-2xl font-bold uppercase tracking-tighter h-16 px-10 text-lg shadow-lg shadow-primary/20"
              onClick={() => navigate(`/messages?userId=${targetUid}&userName=${encodeURIComponent(profileData.name)}&company=${encodeURIComponent(profileData.company)}`)}
            >
              <MessageSquare className="mr-2 h-5 w-5" /> Contactar
            </Button>
          )}
        </motion.div>

        {/* Metrics */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              {isOwnProfile ? 'Métricas de tu Concesionaria' : 'Estadísticas del Vendedor'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard icon={Eye}          label="Vistas totales"     value={totalViews}             accent />
            <StatCard icon={MessageSquare} label="Consultas recibidas" value={totalContacts}          />
            <StatCard icon={Package}      label="Stock activo"        value={activeListings.length}  accent />
            <StatCard icon={CheckCircle2} label="Unidades vendidas"   value={soldListings.length}    />
          </div>
        </div>

        <Separator className="mb-16" />

        {/* Listings */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-primary" />
              {isOwnProfile ? 'Administrar mi Stock' : 'Unidades Disponibles'}
            </h2>
            {isOwnProfile && (
              <Button onClick={() => navigate('/publish')} disabled={trialExpired} className="rounded-full font-bold uppercase tracking-widest text-[10px] gap-2">
                {trialExpired ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {trialExpired ? 'Prueba vencida' : 'Nueva Unidad'}
              </Button>
            )}
          </div>

          {visibleListings.length === 0 ? (
            <div className="p-20 text-center border-2 border-dashed border-border rounded-[3rem] space-y-4">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground font-medium">No hay publicaciones activas en este momento.</p>
              {isOwnProfile && (
                <Button onClick={() => navigate('/publish')} className="rounded-full gap-2">
                  <Plus className="h-4 w-4" /> Publicar primera unidad
                </Button>
              )}
            </div>
          ) : isOwnProfile ? (
            <Tabs defaultValue="all">
              <TabsList className="mb-8 bg-muted rounded-2xl p-1 h-auto gap-1 flex-wrap">
                <TabsTrigger value="all"    className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Todo ({allListings.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-4 py-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                  Activos ({activeListings.length})
                </TabsTrigger>
                <TabsTrigger value="paused" className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-4 py-2 data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                  Pausados ({pausedListings.length})
                </TabsTrigger>
                <TabsTrigger value="sold"   className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-4 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  Vendidos ({soldListings.length})
                </TabsTrigger>
              </TabsList>

              {(['all', 'active', 'paused', 'sold'] as const).map(tab => {
                const list = tab === 'all' ? allListings
                  : tab === 'active' ? activeListings
                  : tab === 'paused' ? pausedListings
                  : soldListings;
                return (
                  <TabsContent key={tab} value={tab}>
                    <VehicleGrid
                      listings={list}
                      isOwnProfile={isOwnProfile}
                      trialExpired={trialExpired}
                      togglingId={togglingId}
                      markingSoldId={markingSoldId}
                      onToggle={handleToggleStatus}
                      onMarkSold={handleMarkSold}
                      onNavigate={(id) => {
                        const v = list.find(x => x.id === id);
                        if (v) navigate(getVehiclePath(v.brand, v.model, v.version, v.year, id));
                      }}
                      onEdit={(id) => navigate(`/publish?edit=${id}`)}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <VehicleGrid listings={visibleListings} isOwnProfile={false} togglingId={null} markingSoldId={null} onToggle={() => {}} onMarkSold={() => {}} onNavigate={(id) => {
              const v = visibleListings.find(x => x.id === id);
              if (v) navigate(getVehiclePath(v.brand, v.model, v.version, v.year, id));
            }} onEdit={() => {}} />
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[3rem] border-border bg-card/95 backdrop-blur-2xl p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold tracking-tighter uppercase">Configuración de Concesionaria</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">Vinculá los datos de tu agencia para que se reflejen en tus publicaciones.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
            <div className="space-y-3 col-span-1 md:col-span-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-primary">Nombre de la Agencia / Concesionaria</Label>
              <Input
                value={editForm.company}
                onChange={e => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Automotores Reven S.A."
                className="h-14 rounded-[2.5rem] bg-muted border-border font-bold px-6"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-primary">Provincia</Label>
              <Select value={editForm.province} onValueChange={v => setEditForm(prev => ({ ...prev, province: v, city: '' }))} disabled={loadingProvincias}>
                <SelectTrigger className="h-14 rounded-[2.5rem] bg-muted border-border font-bold px-6">
                  <SelectValue>{loadingProvincias ? 'Cargando...' : (provincias.find(p => p.id === editForm.province)?.nombre || 'Seleccionar')}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-[2.5rem]">
                  {provincias.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Localidad</Label>
              <Select value={editForm.city} onValueChange={v => setEditForm(prev => ({ ...prev, city: v }))} disabled={!editForm.province || loadingLocalidades}>
                <SelectTrigger className="h-14 rounded-[2.5rem] bg-muted border-border font-bold px-6">
                  <SelectValue>{loadingLocalidades ? 'Cargando...' : (localidades.find(l => l.id === editForm.city)?.nombre || 'Seleccionar')}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-[2.5rem]">
                  {localidades.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Teléfono Público</Label>
              <Input
                value={editForm.phone}
                onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+54 9 11 ..."
                className="h-12 rounded-xl bg-muted border-border font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Tu Nombre de Contacto</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre"
                className="h-12 rounded-xl bg-muted border-border font-bold"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-xs">
              Cancelar
            </Button>
            <Button onClick={handleUpdateProfile} disabled={editLoading} className="rounded-xl font-bold uppercase tracking-widest text-xs gap-2 min-w-[140px]">
              {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VehicleGrid({
  listings, isOwnProfile, trialExpired = false, togglingId, markingSoldId, onToggle, onMarkSold, onNavigate, onEdit,
}: {
  listings: Vehicle[];
  isOwnProfile: boolean;
  trialExpired?: boolean;
  togglingId: string | null;
  markingSoldId: string | null;
  onToggle: (v: Vehicle) => void;
  onMarkSold: (v: Vehicle) => void;
  onNavigate: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  if (listings.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-border rounded-[3rem]">
        <p className="text-muted-foreground font-medium text-sm">Sin unidades en esta categoría.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {listings.map((listing, i) => {
        const statusCfg = STATUS_CONFIG[listing.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
        const isToggling = togglingId === listing.id;
        const isMarkingSold = markingSoldId === listing.id;

        return (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="group relative bg-card border border-border hover:border-primary/30 rounded-[2.5rem] overflow-hidden transition-all duration-500 shadow-sm"
          >
            {/* Photo */}
            <div
              className="relative aspect-video overflow-hidden cursor-pointer"
              onClick={() => onNavigate(listing.id)}
            >
              <img
                src={listing.photos?.[0] || 'https://images.unsplash.com/photo-1542362567-b05503f3f7f4?q=80&w=800'}
                alt={`${listing.brand} ${listing.model}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute top-4 left-4">
                <Badge className={`border font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider ${statusCfg.color}`}>
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-black text-[10px] px-3 py-1.5 rounded-full uppercase">
                  {listing.year}
                </Badge>
                <Badge className="bg-primary text-primary-foreground font-black text-[10px] px-3 py-1.5 rounded-full uppercase shadow-xl">
                  {listing.currency} {listing.price?.toLocaleString()}
                </Badge>
              </div>
            </div>

            {/* Info */}
            <div className="p-6 space-y-4">
              <div className="cursor-pointer" onClick={() => onNavigate(listing.id)}>
                <h3 className="text-xl font-bold tracking-tighter uppercase">{listing.brand} {listing.model}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{listing.version}</p>
              </div>

              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> {listing.viewCount || 0} Vistas</span>
                <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-primary" /> {listing.contactCount || 0} Consultas</span>
              </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(listing.id)}
                    className="rounded-full font-bold uppercase tracking-widest text-[9px] h-8 px-4 border-border hover:border-primary/30 gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" /> Editar
                  </Button>
                  {listing.status !== 'SOLD' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isToggling || isMarkingSold || (trialExpired && listing.status === 'PAUSED')}
                        onClick={() => onToggle(listing)}
                        className="rounded-full font-bold uppercase tracking-widest text-[9px] h-8 px-4 border-border hover:border-primary/30 gap-1.5"
                      >
                        {isToggling ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : trialExpired && listing.status === 'PAUSED' ? (
                          <><Lock className="h-3 w-3" /> Requiere plan</>
                        ) : listing.status === 'ACTIVE' ? (
                          <><Pause className="h-3 w-3" /> Pausar</>
                        ) : (
                          <><Play className="h-3 w-3" /> Activar</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isToggling || isMarkingSold}
                        onClick={() => onMarkSold(listing)}
                        className="rounded-full font-bold uppercase tracking-widest text-[9px] h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
                      >
                        {isMarkingSold ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><CheckCircle2 className="h-3 w-3" /> Vendido</>
                        )}
                      </Button>
                    </>
                  )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
