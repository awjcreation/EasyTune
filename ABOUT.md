# About EasyTune

## 🎸 What is EasyTune?

**EasyTune** is a lightweight, progressive web app (PWA) that brings essential guitar tools right to your fingers. Designed for musicians at any level, EasyTune offers three powerful features in one beautifully crafted interface:

### Core Features

#### 🎵 **Transpozycja (Transposition)**
Instantly transpose chord progressions to any key without re-learning fingerings. Perfect for:
- Playing songs in different keys
- Adapting to singer's vocal range
- Experimenting with arrangements
- Quick songwriting ideas

#### 🎼 **Akordy (Chords)**
Browse and search guitar chord diagrams with:
- Interactive chord filtering (major, minor, 7th, maj7, sharps)
- Letter-based quick search
- Clear fretboard diagrams
- Note information for each chord
- Support for Polish and English chord notation

#### ⏱️ **Metronom (Metronome)**
Professional-grade timing with:
- Customizable BPM (40-240)
- Multiple time signatures (2/4 through 6/8)
- Accent modes (first beat, every beat, or none)
- Tap Tempo for quick tempo entry
- Visual and audio feedback
- Clean, minimal interface

---

## 💡 Why EasyTune?

### Offline-First
- Works completely offline after first load
- No internet required to practice
- All data stored locally on your device
- Instant load times

### Privacy-Focused
- **Zero tracking** - no analytics or telemetry
- No accounts or logins needed
- All data stays on your device
- No data sent to any server

### Lightweight
- ~65KB total (HTML, CSS, JavaScript)
- Fast to load, even on slow connections
- Minimal battery usage
- Works on any modern browser

### Installable
- Install as app on iOS, Android, macOS, Windows, Linux
- Standalone app experience
- Home screen icon
- App switcher support
- Works like native app

### Open Source
- MIT License - free to use and modify
- Transparent development
- Community contributions welcome
- See code, learn from code

---

## 🎯 Use Cases

**Practice Sessions**
- Keep perfect time with metronome
- Learn chords visually
- Practice transposing

**Songwriting**
- Quickly transpose ideas to different keys
- Reference chord voicings
- Experiment with time signatures

**Performance**
- Silent tap tempo for quick tempo changes
- Chord diagrams for reference
- Visual metronome feedback

**Education**
- Learn chord theory with note information
- Understand transposition mechanics
- Master time signatures

---

## 🚀 Getting Started

### Online
1. Visit [EasyTune](https://awjcreation.github.io/EasyTune) in your browser
2. Start using immediately
3. Bookmark for quick access

### Install as App

**iOS:**
1. Open in Safari
2. Tap Share → Add to Home Screen
3. Done! App appears on home screen

**Android:**
1. Open in Chrome
2. Menu → Install app (or "Add to home screen")
3. Done! App in your app drawer

**Desktop (macOS/Windows/Linux):**
1. Open in Chrome, Edge, or Firefox
2. Menu → Install (exact location varies)
3. Done! App in your applications

---

## 🛠️ Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Grid/Flexbox
- **JavaScript (ES6+)** - Modular architecture
- **Web Audio API** - Metronome synthesis
- **Service Workers** - Offline functionality
- **Web App Manifest** - PWA installation

---

## 📊 Architecture

EasyTune uses a modular, ES6 module-based architecture:

- **`config.js`** - Centralized configuration
- **`utils.js`** - Reusable utilities
- **`transpose-module.js`** - Transposition feature
- **`chords-module.js`** - Chord management
- **`metronome-module.js`** - Timing and audio
- **`app-main.js`** - Application controller

This structure makes the code:
- Easy to understand
- Simple to modify
- Possible to test
- Ready to extend

---

## 🌍 Supported Browsers

### Desktop
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### Mobile
- ✅ iOS Safari 11+
- ✅ Android Chrome 60+
- ✅ Android Firefox 68+
- ✅ Samsung Internet 8+

---

## 📝 Features in Detail

### Transposition
- Recognizes chord tokens automatically
- Preserves original formatting and spacing
- Supports slash chords (e.g., G/B)
- Handles multiple accidentals (sharps/flats)
- One-click copy of results

### Chords
- 60+ chord variations per key
- Major, minor, 7th, maj7 chords
- Filter by letter, quality, or accidental
- SVG diagrams with clear fret markers
- Note breakdown for each chord
- Polish notation support (H/B)

### Metronome
- RAF-based precise timing (±10ms)
- Web Audio API for clicks
- Visual pendulum animation
- Beat counter with accents
- BPM slider with presets (60-160)
- Tap Tempo with rolling average
- Settings persistence

---

## 🔧 Customization

Users can customize:
- **BPM:** 40 to 240 beats per minute
- **Time Signature:** 2/4, 3/4, 4/4, 5/4, 6/8
- **Accent Mode:** First beat, every beat, or none
- **Visual Mode:** Sound, lights, or both
- **Song Data:** Saved locally, synced across sessions

---

## 💾 Data Storage

- Songs are saved to **localStorage** automatically
- Metronome settings persist between sessions
- ~5MB storage quota (typical browser limit)
- No data sent anywhere
- User has full control

---

## 🎓 Learning Resources

### For Musicians
- Try transposing a favorite song
- Use chord filters to learn chord families
- Practice with metronome at various tempos
- Explore slash chords and variations

### For Developers
- See `/js` directory for modular code
- Read `REFACTORING.md` for architecture
- Check `CONTRIBUTING.md` to contribute
- Review `config.js` for customization points

---

## 📄 License

EasyTune is released under the **MIT License**.

You are free to:
- Use commercially or personally
- Modify the code
- Distribute modified versions
- Use as part of other projects

See `LICENSE` file for details.

---

## 🤝 Contributing

We welcome contributions! See `CONTRIBUTING.md` for:
- Development setup
- Code style guidelines
- Pull request process
- Reporting bugs
- Feature requests

---

## 📧 Contact & Support

- **Issues:** Report bugs on [GitHub Issues](https://github.com/awjcreation/EasyTune/issues)
- **Features:** Suggest improvements on [GitHub Discussions](https://github.com/awjcreation/EasyTune/discussions)
- **Author:** [@awjcreation](https://github.com/awjcreation)

---

## 🙏 Acknowledgments

Built with:
- Love for music and clean code
- Attention to accessibility
- Respect for user privacy
- Modern web standards

---

## 🚀 Future Roadmap

Potential features being considered:
- [ ] Tuner tool
- [ ] Chord progression builder
- [ ] Recording/playback
- [ ] Setlist manager
- [ ] Scale references
- [ ] Multiple language support
- [ ] Dark/light theme toggle
- [ ] Export as PDF

---

**EasyTune** - Guitar Tools, Simplified  
*Made for musicians, by musicians. Open source. Privacy-first. Forever free.*

---

**Version:** 2.5.0  
**Last Updated:** 2026-06-19  
**License:** MIT
