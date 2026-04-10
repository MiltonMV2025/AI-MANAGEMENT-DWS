import {
  Bug,
  Cloud,
  Cpu,
  FolderKanban,
  KeyRound,
  type LucideIcon,
  Rocket,
  Server,
  Shield,
  ShoppingCart,
} from "lucide-react";

export type IconName =
  | "folder"
  | "bug"
  | "shield"
  | "cart"
  | "cloud"
  | "server"
  | "rocket"
  | "key"
  | "cpu";

export type IconOption = {
  key: IconName;
  label: string;
  icon: LucideIcon;
};

export const ICON_OPTIONS: IconOption[] = [
  { key: "folder", label: "General", icon: FolderKanban },
  { key: "bug", label: "Bug", icon: Bug },
  { key: "shield", label: "Security", icon: Shield },
  { key: "cart", label: "Checkout", icon: ShoppingCart },
  { key: "cloud", label: "Cloud", icon: Cloud },
  { key: "server", label: "Backend", icon: Server },
  { key: "rocket", label: "Release", icon: Rocket },
  { key: "key", label: "Auth", icon: KeyRound },
  { key: "cpu", label: "System", icon: Cpu },
];

const iconLookup = new Map<IconName, LucideIcon>(ICON_OPTIONS.map((item) => [item.key, item.icon]));

export function getIconByName(name: string | null | undefined): LucideIcon {
  if (!name) return FolderKanban;
  return iconLookup.get(name as IconName) ?? FolderKanban;
}