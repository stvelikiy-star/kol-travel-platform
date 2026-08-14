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
  rating: number;
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
  id: string;
  roomId: string;
  date: string;
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
  rating: number;
  status: string;
};

export type PartnerTourSchedule = {
  id: string;
  tourId: string;
  date: string;
  startTime: string;
  capacity: number;
  bookedSeats: number;
  status: string;
};

export type PartnerAvailabilityData = {
  stays: PartnerStay[];
  rooms: PartnerRoom[];
  roomAvailability: PartnerRoomAvailability[];
  tours: PartnerTour[];
  tourSchedules: PartnerTourSchedule[];
};
