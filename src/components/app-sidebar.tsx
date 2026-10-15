"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconBuildingStore,
  IconCalendarClock,
  IconChevronRight,
  IconDashboard,
  IconFingerprint,
  IconBrandWhatsapp,
  IconHelpCircle,
  IconInnerShadowTop,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
  IconBarbell,
  IconCash,
  IconPlayerTrackPrev,
  IconToiletPaper,
  type Icon,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ModeToggle } from "./custom/theme-toggle";
import { GetSessionInfo, SessionInfo, SignOut } from "@/action/staff.action";

interface NavItem {
  title: string;
  icon: Icon;
  url?: string;
  // Hidden from front-desk staff logins.
  ownerOnly?: boolean;
  children?: { title: string; url: string; ownerOnly?: boolean }[];
}

// Names follow the ones gym owners already know from other gym software.
const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Management",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
      {
        title: "Attendance Management",
        icon: IconUserCheck,
        children: [
          { title: "Member Attendance", url: "/attendance" },
          { title: "Staff Attendance", url: "/staff-attendance" },
          { title: "View Attendance", url: "/attendance/history" },
        ],
      },
      {
        title: "Member Management",
        icon: IconUsers,
        children: [
          { title: "Add Member", url: "/members/new" },
          { title: "View Member", url: "/members" },
          { title: "View Batch", url: "/members/batches" },
          { title: "InActive Member", url: "/members?view=inactive" },
          { title: "BlackList Member", url: "/members?view=blacklist" },
          { title: "Dormant Member", url: "/members?view=dormant" },
          { title: "Birthdays", url: "/members/birthdays" },
        ],
      },
      {
        title: "Enquiry Management",
        icon: IconHelpCircle,
        children: [
          { title: "Add Enquiry", url: "/enquiries/new" },
          { title: "View Enquiry", url: "/enquiries" },
          { title: "Today's Follow-ups", url: "/enquiries/followups" },
        ],
      },
      {
        title: "Subscription Management",
        icon: IconReceipt,
        children: [
          { title: "Add Subscription", url: "/sales/new" },
          { title: "View Subscriptions", url: "/sales" },
          { title: "View Pending Renewal", url: "/members?view=renewal" },
          { title: "Pending Payments", url: "/sales/pending-payments" },
          { title: "Renewal Follow-ups", url: "/sales/followups" },
        ],
      },
      {
        title: "Package Management",
        icon: IconPackage,
        ownerOnly: true,
        children: [
          { title: "Add Package", url: "/services/new" },
          { title: "View Package", url: "/services" },
        ],
      },
      { title: "Trainer Management", url: "/trainers", icon: IconBarbell, ownerOnly: true },
      {
        title: "BackDate Management",
        icon: IconPlayerTrackPrev,
        children: [
          { title: "BackDate Add Member", url: "/members/new?backdate=1" },
          { title: "BackDate Renew Subscription", url: "/sales/new?backdate=1" },
          { title: "BackDate Add Enquiry", url: "/enquiries/new?backdate=1" },
          { title: "BackDate Others", url: "/backdate" },
        ],
      },
    ],
  },
  {
    label: "Add On",
    items: [
      {
        title: "Expense Management",
        icon: IconCash,
        ownerOnly: true,
        children: [
          { title: "Add Expense", url: "/expenses?add=1" },
          { title: "View Expense", url: "/expenses" },
          { title: "Payment Report", url: "/payments" },
        ],
      },
      { title: "WhatsApp Management", url: "/whatsapp", icon: IconBrandWhatsapp, ownerOnly: true },
      { title: "Fitness Tools", url: "/tools", icon: IconToiletPaper },
    ],
  },
  {
    label: "Staff",
    items: [
      {
        title: "Staff Management",
        icon: IconUsersGroup,
        ownerOnly: true,
        children: [
          { title: "Add Staff", url: "/staff?add=1" },
          { title: "View Staff", url: "/staff" },
        ],
      },
    ],
  },
  {
    label: "Biomax",
    items: [
      {
        title: "Biometric Management",
        icon: IconFingerprint,
        children: [
          { title: "Add Biometric", url: "/attendance/biometric?tab=enroll" },
          { title: "Block Biometric", url: "/attendance/biometric?tab=block" },
          { title: "Delete Biometric", url: "/attendance/biometric?tab=delete" },
          { title: "View Commands", url: "/attendance/biometric?tab=commands" },
          { title: "Machine Setup", url: "/attendance/biometric?tab=machines", ownerOnly: true },
        ],
      },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Gym Settings", url: "/settings", icon: IconSettings, ownerOnly: true }],
  },
];

function NavGroup({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const here = pathname + (search.toString() ? `?${search}` : "");
  const isActive = (url: string) => here === url || (!url.includes("?") && pathname === url);
  const containsActive = item.children?.some((child) => isActive(child.url)) ?? false;
  const [open, setOpen] = React.useState(containsActive);
  React.useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  if (!item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive(item.url!)} tooltip={item.title}>
          <Link href={item.url!}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setOpen(!open)} tooltip={item.title}>
        <item.icon />
        <span>{item.title}</span>
        <IconChevronRight className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.url}>
              <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                <Link href={child.url}>{child.title}</Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [session, setSession] = React.useState<SessionInfo | null>(null);
  React.useEffect(() => {
    GetSessionInfo().then(setSession);
  }, []);
  const isStaff = session?.role === "staff";
  const visible = (item: { ownerOnly?: boolean }) => !(isStaff && item.ownerOnly);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-between items-center">
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/dashboard">
                {session?.gymLogo
                  ? <img src={session.gymLogo} alt="" className="size-6 rounded object-contain" />
                  : <IconInnerShadowTop className="!size-5" />}
                <span className="text-base font-semibold">{session?.gymName ?? "Gym"}</span>
              </Link>
            </SidebarMenuButton>
            <ModeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {SECTIONS.map((section) => {
          const items = section.items
            .filter(visible)
            .map((item) => ({ ...item, children: item.children?.filter(visible) }));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <NavGroup key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            {session?.role === "superadmin" && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/gyms">
                    <IconBuildingStore />
                    <span>All gyms</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => {
                  await SignOut();
                  window.location.href = "/signin";
                }}
              >
                <IconLogout />
                <span>Logout{session ? ` (${session.name})` : ""}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
