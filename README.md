# Purity Lock v2.2.0 — Enterprise Productivity Suite

Purity Lock is a high-end, commercial-quality browser extension designed to help you stay focused, build healthy habits, and maintain personal accountability. It features a stunning glassmorphism design, intelligent search monitoring, and a robust recovery ecosystem.

## Premium Features

| Category | Key Capabilities |
| :--- | :--- |
| **Smart Blocking** | Category-based filtering (Adult, Social, Gaming, etc.), real-time search monitoring, and search suggestion blocking. |
| **Recovery Flow** | Configurable grace period, circular countdowns, guided breathing, and offline Bible verse search. |
| **Advanced Dashboard** | Productivity trends, monthly focus calendar, category distribution charts, and a detailed activity log. |
| **Focus Mode** | Custom lock durations (up to 24h), Pomodoro cycles, and auto-start schedules. |
| **Safety Systems** | 2-hour bypass penalty for closing recovery pages, triple-confirmation emergency unlock, and Strict Mode. |
| **Design System** | Full glassmorphism UI, six premium themes, accent color customization, and responsive layouts. |
| **Accessibility** | High contrast mode, reduced motion support, and full keyboard navigation compatibility. |

## Installation Instructions

1. Download and extract the `purity-lock-v2.2.zip` file.
2. Open Chrome or Edge and navigate to the Extensions page (`chrome://extensions/`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `purity-lock` folder.
5. Pin the extension to your toolbar for quick access.

## Technical Architecture

Purity Lock is built on a modern **Manifest V3** architecture. It utilizes an ES module-based Service Worker for background logic, ensuring high performance and reliability. All user data is stored locally using `chrome.storage.local`, providing complete privacy and offline functionality. The UI is built with standard HTML5/CSS3 and native JavaScript, avoiding heavy external dependencies.

## Changelog

### v2.2.0 (The Enterprise Update)
- **New**: Smart Search Monitoring with escalating penalties (10m, 20m, 30m).
- **New**: Search Suggestion Blocker for Google, Bing, and DuckDuckGo.
- **New**: Category-based website detection and analytics.
- **New**: Monthly Focus Calendar and trend visualization.
- **New**: Full Pomodoro cycle integration in Focus Mode.
- **New**: Glassmorphism UI overhaul with circular progress rings.
- **New**: Accessibility suite (High Contrast, Reduced Motion).
- **New**: Backup, Restore, and History Management.
- **Fix**: Implemented 2-hour penalty for bypassing recovery screens.
- **Fix**: Added triple-confirmation for emergency overrides.

> "Your mind is your most valuable asset. Protect it with Purity Lock."
