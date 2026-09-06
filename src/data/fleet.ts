export interface Airframe {
  name: string;
  variant?: string;
  cost: number;
  seats: number;
  role: string;
}

export const fleet: Airframe[] = [
  {
    name: "MH-6",
    cost: 6250,
    seats: 6,
    role: "Light air transport. Cheapest thing that flies and the best trainer — small, agile, teaches momentum fast.",
  },
  {
    name: "AH-6M",
    variant: "Miniguns",
    cost: 7000,
    seats: 2,
    role: "Armed Little Bird. Typically the first helicopter you unlock.",
  },
  {
    name: "UH-1Y",
    cost: 7400,
    seats: 9,
    role: "Air transport. The most seats in the game — heavier, less forgiving.",
  },
  {
    name: "UH-1Y",
    variant: "Miniguns",
    cost: 8000,
    seats: 9,
    role: "Armed utility. Transport that can shoot back.",
  },
  {
    name: "AH-6R",
    variant: "Rockets",
    cost: 12500,
    seats: 2,
    role: "Rocket Little Bird. Good against artillery.",
  },
  {
    name: "Havoc",
    cost: 18000,
    seats: 2,
    role: "Dedicated attack helicopter, pilot and gunner. The most expensive vehicle in the game.",
  },
];

export const money = (n: number) => "$" + n.toLocaleString("en-US");
