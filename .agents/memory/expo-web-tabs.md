---
name: Expo tab preview
description: Cross-platform routing behavior for Expo Router tab layouts.
---

Liquid-glass NativeTabs should only be selected when `Platform.OS === 'ios'`; Android and web previews should use the classic tab layout.

**Why:** Selecting the native branch outside iOS can leave the web preview blank even when Metro bundles successfully.

**How to apply:** In tab layout selection, check the platform before calling the liquid-glass availability branch.