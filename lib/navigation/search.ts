import type { UserRole } from "@/lib/auth/types";
import { getNavigation, getSectionHref } from "./index";
import type { NavItem } from "./types";

export interface SearchableSection {
  id: string;
  label: string;
  href: string;
  icon: NavItem["icon"];
  groupTitle: string;
}

export function getSearchableSections(role: UserRole): SearchableSection[] {
  const navigation = getNavigation(role);

  return navigation.groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      href: getSectionHref(role, item.id),
      icon: item.icon,
      groupTitle: group.title,
    })),
  );
}

export function filterSections(
  sections: SearchableSection[],
  query: string,
): SearchableSection[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return sections;
  }

  return sections.filter((section) =>
    section.label.toLowerCase().includes(normalized),
  );
}
