<p align="center">
    <!-- 🔁 Replace with your own logo -->
    <img src="https://cdn.discordapp.com/attachments/1494647235562963015/1494751998539599882/Gemini_Generated_Image_xsldiixsldiixsld.png?ex=69e51147&is=69e3bfc7&hm=5d58e15a14abef47b167f5c0b477c77655906a81d3c17f335234ab366e7697af&" width="256" height="256" />
</p>

<h1 align="center">metStremio</h1>

<p align="center">
  <strong>Discord Rich Presence for Stremio.</strong>
  <br />
  A lightweight local addon that shows what you're watching on Discord — clean, simple, and real-time.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=fff" alt="npm" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Stremio-8D3DAF?logo=stremio&logoColor=white" alt="Stremio" />

  <img src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=F0F0F0" alt="macOS" />
  <img src="https://custom-icon-badges.demolab.com/badge/Windows-0078D6?logo=windows11&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black" alt="Linux" />
</p>

---

## ✨ What is metStremio?

**metStremio** is a *local addon for Stremio* that connects your playback activity with **Discord Rich Presence**.

It doesn’t stream anything or provide content.. it simply detects what you’re watching on your machine and updates your Discord status in real time.

- **Runs locally** on your machine  
- **Syncs playback** with Discord Rich Presence  
- Supports *movies and series* in Stremio  
- Lightweight **background process**  
- No streaming or content handling — just *activity tracking*  
---

## Preview

<p align="center">
  <!-- 🔁 Insert UI / Discord preview -->
  <img src="https://cdn.discordapp.com/attachments/1494647235562963015/1496285256959918110/Screenshot_2026-04-21_at_11.55.34_PM.jpeg?ex=69e953bc&is=69e8023c&hm=c672ab2a20b63a9801458cec15fdfe95e88c46064d0595734175ce48c69a2d55&" />
  <img src="https://cdn.discordapp.com/attachments/1494647235562963015/1496285257194934292/Screenshot_2026-04-21_at_11.57.48_PM.jpeg?ex=69e953bc&is=69e8023c&hm=b62d5bb9e72eda91741f44e50dd505f707a4a37755387f7075d83d8ac0f16e27&" />
</p>

--- 

### 🖥️ Operating System

| OS                            | Description                                         | Support |
|-------------------------------|-----------------------------------------------------|---------|
| Windows                       | Works out of the box. No additional setup required.           | ✅ Stable      |
| macOS                         | Requires accessibility permissions for your terminal to function properly.      | ⚠️ Unstable     |
| Linux                         | Not supported yet (planned).                           | ❌ N/A     |

---

## 🐞 Known Issues
> [!NOTE]
> Currently, only movies are supported. Series support will be added in the next update, which is coming very soon..
- Subtitles may interfere with Rich Presence titles (disabling them improves stability)
- On macOS, you may need to pause and resume playback for detection to register correctly
- This is an early version, so occasional bugs or inconsistencies are expected
- Waiting for more bugs... xD

---

## Requirements
- **Node.js (v18+)**  
- **npm** (comes with Node.js)  
- **Stremio v5+**  
- A terminal (VSCode, PowerShell, macOS Terminal, etc.)
- **Discord desktop app** (required for Rich Presence to show) 

---

## 🛠️ Installation
> [!WARNING]
> macOS requires accessibility permissions for metStremio to work correctly.  
> Enable them in **System Settings → Privacy & Security → Accessibility**

- ### 1. Clone the repository
```bash
git clone https://github.com/metloub/metStremio.git && cd metStremio
```
- ### 2. Install the dependencies
```bash
npm install
```
- ### 3. Create a `.env`
```bash
cp .env.example .env
```
> [!IMPORTANT]
> metStremio uses the OMDb API for movie and series metadata (titles, posters, descriptions).
> To enable these features, add your API key to your `.env` file.
> You can get a free key here: https://www.omdbapi.com/apikey.aspx
> **Keep your key private and NEVER commit it to GitHub.**
- ### 3. Start the addon
```bash
npm start
```
- ### 4. Add to Stremio
- Open Stremio
- Go to Addons → Community Addons
- Paste your local URL:
``` bash
http://127.0.0.1:11470/manifest.json
```

---

## 🤝 Contributing

Contributions are welcome as this is an open-source project and any help is appreciated.

### How to contribute

1. Fork the project  
2. Create your feature branch  
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes
   ```bash
   git commit -m 'Add some feature'
   ```
4. Push to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request

 ---
 
## 📬 Contact

If you need help, want to report an issue, or just want to talk about the project:

- 💬 Discord Server → https://discord.metloub.com  
- 📧 Email → business@metloub.com  
- 👤 Discord → @floptropica  

---

## ✨ Donate

metStremio is a project I’m building and maintaining.
If you like it:
- ⭐ Star the repository
- 🗣 Share it with others
- ☕ Buy me a Ko-Fi → https://ko-fi.com/metloub

---

<h2 align="center"> ⭐ Star History</h2>

<p align="center">
  <img src="https://api.star-history.com/svg?repos=metloub/metStremio&type=Date" href="https://www.star-history.com/#metloub/metStremio&Date" alt="Filtering and Sorting Rules" width="750"/>
</p>

---

## 📄 License

metStremio is an open-source project released under the [MIT License](LICENSE).

This means you are free to:

- Use the project for personal or commercial purposes  
- Modify the source code however you like  
- Distribute copies of the project  
- Include it in your own projects  

There are only a few simple conditions:

- You must include the original license notice  
- You must credit the original project when redistributing  
- The software is provided “as is”, without warranty of any kind  

---

### ⚖️ Disclaimer

This project is provided in good faith, but without any guarantees.

The author is not responsible for:
- Any issues caused by usage of the software  
- Data loss or system problems  
- Misuse of the project or its features  

**Use it at your own risk.**
