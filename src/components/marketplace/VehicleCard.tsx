import { Star, MapPin, Fuel, Gauge, Calendar, ArrowUpRight, CheckCircle2, Car } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Vehicle } from '@/src/types';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getVehiclePath } from '@/src/lib/seo';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const hasPhoto = vehicle.photos?.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={getVehiclePath(vehicle.brand, vehicle.model, vehicle.version, vehicle.year, vehicle.id)}>
        <Card className="overflow-hidden group bg-card/50 border-border hover:border-primary/50 transition-colors duration-500 rounded-2xl gap-0 py-0">
          <div className="relative aspect-[16/11] overflow-hidden bg-muted">
            {hasPhoto ? (
              <img
                src={vehicle.photos[0]}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Car className="h-16 w-16 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="flex gap-2">
                {vehicle.isFeatured && (
                  <Badge className="bg-primary text-primary-foreground border-none font-bold tracking-tighter px-3 py-1 rounded-full shadow-lg shadow-primary/20 text-[10px]">
                    <Star className="h-3 w-3 fill-current mr-1" /> DESTACADO
                  </Badge>
                )}
                {vehicle.isInspected && (
                  <Badge className="bg-blue-500 text-white border-none font-bold tracking-tighter px-3 py-1 rounded-full shadow-lg shadow-blue-500/20 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> PERITADO
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Badge className="bg-white/10 backdrop-blur-md text-white border-white/10 font-bold px-3 py-1 rounded-full text-[10px]">
                  {vehicle.condition}
                </Badge>
                <Badge className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold tracking-tighter px-3 py-1 rounded-full text-[10px]">
                  MAYORISTA
                </Badge>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="space-y-0.5">
                <h3 className="font-bold text-2xl leading-none uppercase tracking-tighter text-white">
                  {vehicle.brand} {vehicle.model}
                </h3>
                <p className="text-sm text-white/70 font-bold uppercase tracking-widest truncate max-w-[180px]">
                  {vehicle.version}
                </p>
              </div>
              <div className="bg-primary text-primary-foreground p-2 rounded-full opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <ArrowUpRight className="h-5 w-5 stroke-[3]" />
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {vehicle.sellerName?.split(' ').map(n => n[0]).join('') ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-tighter leading-none">{vehicle.sellerName}</h4>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Miembro REVEN</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px]">{vehicle.location}</span>
              </div>
            </div>

            <p className="font-bold text-3xl text-primary tracking-tighter">
              {vehicle.currency} {vehicle.price?.toLocaleString('es-AR') ?? '—'}
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{vehicle.year}</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{vehicle.km?.toLocaleString('es-AR')} KM</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors">
                <Fuel className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center">{vehicle.fuelType}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-6 pt-0">
            <Button className="w-full rounded-full font-bold uppercase tracking-widest text-[10px] h-11 shadow-lg shadow-primary/20">
              VER DETALLE DEL VEHÍCULO
            </Button>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
