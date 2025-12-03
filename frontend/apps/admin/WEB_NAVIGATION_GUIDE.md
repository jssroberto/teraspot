# Web Navigation Guide

## Overview

The TeraSpot Admin app now features a **Google Classroom-style navigation** for web browsers, while maintaining the native tab bar on mobile devices.

## Navigation Features

### 🖥️ **Desktop View (≥ 768px)**

On desktop browsers, you'll see a **horizontal navigation bar** at the top with:

- **Brand Logo** - "TeraSpot Admin" with lightning bolt icon
- **Navigation Tabs** - Dashboard, Devices, Explore displayed horizontally
- **Active Indicator** - Blue underline shows the current active tab
- **Action Buttons** - Notifications bell and user profile icons

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ TeraSpot Admin  [Dashboard] [Devices] [Explore]  🔔 👤  │
│                         ═══════                              │
└─────────────────────────────────────────────────────────────┘
```

### 📱 **Mobile View (< 768px)**

On mobile browsers, you'll see a **dropdown menu** similar to Google Classroom:

- **Brand Logo** - "TeraSpot Admin" on the left
- **Dropdown Button** - Shows current tab with icon and chevron
- **Dropdown Menu** - Click to see all available tabs
- **Active Indicator** - Checkmark shows the current tab
- **Action Buttons** - Notifications and profile on the right

```
┌──────────────────────────────────────────────┐
│ ⚡ TeraSpot  [📊 Dashboard ▼]  🔔 👤        │
└──────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────┐
    │ 📊 Dashboard ✓  │
    │ 🏠 Devices      │
    │ ✈️  Explore     │
    └─────────────────┘
```

### 📱 **Native Mobile Apps**

On iOS and Android, the app continues to use the **native bottom tab bar** for familiar mobile navigation.

## How It Works

### Platform Detection

The navigation system automatically detects the platform:

- **Web**: Shows top navbar (desktop horizontal or mobile dropdown)
- **iOS/Android**: Shows bottom tab bar (native mobile navigation)

### Responsive Breakpoint

The web navigation switches between desktop and mobile layouts at **768px width**:

- **≥ 768px**: Horizontal navigation tabs
- **< 768px**: Dropdown menu

### Active Tab Detection

The navbar automatically highlights the current tab based on the URL:
- `/dashboard` → Dashboard tab active
- `/` or `/index` → Devices tab active  
- `/explore` → Explore tab active

## Components

### 1. **WebNavBar** (`components/web-navbar.tsx`)

The main navigation component that renders:
- Desktop horizontal navigation
- Mobile dropdown navigation
- Active tab highlighting
- Action buttons

### 2. **WebLayoutWrapper** (`components/web-layout-wrapper.tsx`)

A wrapper component that:
- Adds the navbar on web platforms
- Passes through children unchanged on mobile
- Maintains proper layout structure

### 3. **Tab Layout** (`app/(tabs)/_layout.tsx`)

Updated to:
- Hide bottom tab bar on web (`Platform.OS === 'web'`)
- Show bottom tab bar on mobile (iOS/Android)

## Customization

### Adding New Tabs

To add a new tab to the navigation, edit `components/web-navbar.tsx`:

```typescript
const navItems: NavItem[] = [
    {
        name: "dashboard",
        title: "Dashboard",
        icon: "chart.bar.fill",
        path: "/(tabs)/dashboard",
    },
    {
        name: "devices",
        title: "Devices",
        icon: "house.fill",
        path: "/(tabs)/",
    },
    {
        name: "explore",
        title: "Explore",
        icon: "paperplane.fill",
        path: "/(tabs)/explore",
    },
    // Add your new tab here:
    {
        name: "settings",
        title: "Settings",
        icon: "gear",
        path: "/(tabs)/settings",
    },
];
```

### Changing the Breakpoint

To change when the navigation switches from mobile to desktop, edit the `isDesktop` calculation in `web-navbar.tsx`:

```typescript
const isDesktop = windowWidth >= 768; // Change 768 to your preferred breakpoint
```

### Customizing Colors

The navbar uses the app's theme colors from `constants/theme.ts`:
- `colors.background` - Navbar background
- `colors.text` - Text color
- `colors.tint` - Active tab color
- `colors.icon` - Icon color

### Changing Brand Text

Edit the brand section in `web-navbar.tsx`:

```typescript
<Text style={[styles.brandText, { color: colors.text }]}>
    Your App Name  {/* Change this */}
</Text>
```

## Testing

### Test on Web

1. Run the web version:
   ```bash
   npm run web
   ```

2. Test desktop view:
   - Open in browser at full width
   - You should see horizontal navigation tabs

3. Test mobile view:
   - Open browser DevTools (F12)
   - Toggle device toolbar (Ctrl+Shift+M)
   - Resize to < 768px width
   - You should see dropdown menu

### Test on Mobile

1. Run on iOS or Android:
   ```bash
   npm run ios
   # or
   npm run android
   ```

2. Verify bottom tab bar is visible (not the top navbar)

## Features

### ✅ Responsive Design
- Automatically adapts to screen size
- Smooth transition between layouts
- No page refresh needed

### ✅ Active Tab Highlighting
- Visual indicator shows current page
- Desktop: Blue underline
- Mobile: Checkmark in dropdown

### ✅ Platform-Specific
- Web: Top navbar
- Mobile: Bottom tab bar
- Consistent experience across platforms

### ✅ Theme Support
- Respects light/dark mode
- Uses app theme colors
- Consistent with app design

### ✅ Accessibility
- Keyboard navigation support
- Touch-friendly on mobile
- Clear visual feedback

## Comparison with Google Classroom

Our navigation is inspired by Google Classroom's web interface:

| Feature | Google Classroom | TeraSpot Admin |
|---------|------------------|----------------|
| Desktop Navigation | Horizontal tabs | ✅ Horizontal tabs |
| Mobile Navigation | Dropdown menu | ✅ Dropdown menu |
| Active Indicator | Underline | ✅ Underline |
| Responsive | Yes | ✅ Yes |
| Brand Logo | Left side | ✅ Left side |
| User Actions | Right side | ✅ Right side |

## Troubleshooting

### Navbar not showing on web
- Check that you're running on web (`Platform.OS === 'web'`)
- Verify `WebLayoutWrapper` is in `app/_layout.tsx`
- Check browser console for errors

### Bottom tabs showing on web
- Verify `tabBarStyle` is set in `app/(tabs)/_layout.tsx`
- Should be: `tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : undefined`

### Dropdown not working
- Check that window width is < 768px
- Verify `useWindowDimensions()` is working
- Check state management for `mobileMenuOpen`

### Active tab not highlighting
- Check `getCurrentTab()` function logic
- Verify pathname matching is correct
- Check that `usePathname()` is returning expected values

## Future Enhancements

Potential improvements:

- [ ] Breadcrumb navigation for nested routes
- [ ] Search bar in navbar
- [ ] User profile dropdown menu
- [ ] Notifications panel
- [ ] Keyboard shortcuts (Cmd/Ctrl + number)
- [ ] Customizable navbar position (top/side)
- [ ] Collapsible sidebar for desktop
- [ ] Quick actions menu

---

**Enjoy your new web navigation! 🎉**
