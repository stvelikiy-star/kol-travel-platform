export type PartnerStay = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  minPricePerNight: number;
  currency: string;
  location: string;
  status: string;
};

export type PartnerRoom = {
  id: string;
  businessId: string;
  stayId: string;
  title: string;
  pricePerNight: number;
  capacity: number;
  status: string;
};

export type PartnerRoomAvailability = {
  roomId: string;
  date: string;
  availableCount: number;
  priceOverride: number | null;
  pricePerNight: number;
  status: string;
};

export type PartnerTour = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  duration: string;
  location: string;
  status: string;
};

export type PartnerTourSchedule = {
  tourId: string;
  date: string;
  time: string;
  capacity: number;
  bookedCount: number;
  status: string;
};

export type PartnerAvailabilityData = {
  stays: PartnerStay[];
  rooms: PartnerRoom[];
  roomAvailability: PartnerRoomAvailability[];
  tours: PartnerTour[];
  tourSchedules: PartnerTourSchedule[];
};
