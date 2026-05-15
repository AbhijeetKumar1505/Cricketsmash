# Executive Summary  
This report provides a **complete pre-deployment checklist** to avoid game submission rejections on Stake Engine. We extract *every explicit rejection reason* from Stake’s official docs and repos, cite them verbatim, and then give concrete remediation steps. The checklist covers art assets, CDN hosting, UI requirements, math/RTP validation, RGS API use, legal disclaimers, localization, accessibility, CI/CD, and more. We include sample grep/jq commands to verify each item, specify the required folder/upload structure, and offer a QA sign-off template. A mapping table links each checklist item to the exact documentation source with rationale. All content is drawn solely from stake-engine.com and StakeEngine GitHub sources【110†L7-L9】【127†L467-L475】.  

## Explicit Rejection Reasons & Requirements  
From Stake Engine’s official guidelines, the following issues will cause immediate rejection (citations in 【】):  

- **Use of Sample Assets:** “Submitted games must use unique audio and visual assets. Assets ... provided with the *web-sdk* sample games will not be approved for publication.”【110†L7-L9】. Including web‑SDK or other stock art is prohibited.  
- **External Asset Hosting:** “All images and fonts must be loaded from the Stake Engine Content Delivery Network (CDN).”【110†L19-L21】. Any assets hosted on other servers will fail validation.  
- **Missing Game Rules/Payout Info:** “Game information must be accessible from the UI, including a detailed description of all game rules.”【110†L25-L27】. Omitting a paytable or rule description leads to rejection.  
- **Unspecified RTP/Max Win:** “The RTP of the game (and each mode…) must be clearly communicated to the player. The maximum win amount for each mode must be clearly displayed.”【110†L31-L34】. Failing to show RTP or max win triggers a rejection.  
- **Incomplete UI & Controls:** The game **must** include a UI guide (explaining buttons), all bet levels, balance display, final win display, autoplay confirmation, sound toggle, and spacebar bet functionality【110†L43-L51】【110†L61-L69】. Missing any mandated UI feature causes rejection.  
- **RGS Integration Errors:** “Session authentication and bet transactions are handled exclusively through the Stake Engine RGS.”【57†L347-L355】. Using a custom auth flow or ignoring `rgs_url` is a non-compliance.  
- **Dynamic Content / XSS Violations:** “The game must be fully static (cannot reach external sources) ... common issues are loading fonts from external servers.”【57†L361-L366】. Any external scripts/fonts or dynamic content is disallowed.  
- **Math/RTP Out-of-Range:** Stake expects game RTP around 90–98%【52†L328-L336】. A significantly higher or lower RTP without justification/simulation could be rejected.  
- **Missing Disclaimers:** Required points (malfunctions, internet, reload, RTP, display, payout source, copyright) must be present【127†L467-L475】. Omitting any clause means automatic failure.  

## Remediation Checklist (Fix & Verify)  

1. **Eliminate Sample Assets:**  
   - *Fix:* Replace any web‑SDK or stock art with original assets. Upload all images/audio to Stake’s CDN and update code to use those URLs.  
   - *Verify:* `grep -R "web-sdk/" -n dist/`; ensure no default asset names remain.  
   ```bash
   grep -R "web-sdk" -n ./build
   ```  
   – If results appear, remove/replace them. Ensure only stakeholder-approved art is present.  

2. **Serve Assets via Stake CDN:**  
   - *Fix:* Audit all asset URLs. Configure your pipeline or build scripts to publish assets to Stake’s CDN.  
   - *Verify:* Search built files for external domains:  
   ```bash
   grep -R -E "http://|https://" -n build/ | grep -v "stakecdn.com"
   ```  
   – If any non-`stakecdn.com` URLs appear, correct them. Only Stake CDN URLs should remain【110†L19-L21】.  

3. **Include Full Rules & Payout Info:**  
   - *Fix:* Implement an in-game **Rules/Paytable screen** listing all symbols, combinations, RTP, and rules. Ensure it is accessible (e.g. via an “info” button).  
   - *Verify:* Manually navigate to the rules screen and confirm all symbol payouts and game rules are listed. Use:  
   ```bash
   grep -R "paytable" -n src/
   ```  
   – Confirm that the rules text references RTP and max wins.  

4. **Display RTP & Max-Win:**  
   - *Fix:* In the UI or paytable, prominently display the game’s RTP (per mode, if multiple) and the maximum possible win【110†L31-L34】.  
   - *Verify:* Check UI elements or console:  
   ```bash
   grep -R "RTP" -n src/ 
   grep -R "Max win" -n src/
   ```  
   – Ensure these values (calculated via math) appear correctly. The RTP should match your simulation (see next).  

5. **UI Controls & Accessibility:**  
   - *Fix:* Add or verify these controls: bet-level selector, balance display, autoplay button (with confirmation popup), a sound-mute toggle, and spacebar triggering the spin/bet button【110†L43-L51】【110†L61-L69】.  
   - *Verify:* Test manually: press **Spacebar** – game should bet. Enable autoplay and ensure it asks for confirmation each time. Click each UI button and ensure it works.  

6. **RGS API Integration:**  
   - *Fix:* Use the Stake RGS endpoints (`Authenticate`, `Play`, `EndRound`). Parse the `rgs_url` query parameter as the base URL【57†L347-L355】. Do **not** hardcode any auth logic.  
   - *Verify:* In the browser dev tools Network tab, verify that an **Authenticate** call is made to the Stake RGS with the correct session token. Also check that bet requests go to the RGS. You can simulate with:  
   ```bash
   curl "https://your-game-url?token=..." | grep "rgs_url"
   ```  
   – The `rgs_url` parameter should be present in the HTML/JS.  

7. **Enforce Static-Only Content:**  
   - *Fix:* Bundle all scripts and assets. Remove any `<script src>` or `<link>` tags referencing outside domains (e.g., Google Fonts). All code must be in the compiled build.  
   - *Verify:* Scan for external fetch calls:  
   ```bash
   grep -R "fetch(" -n build/ || echo "No fetch calls found."
   grep -R "XMLHttpRequest" -n build/ || echo "No XHR found."
   ```  
   – Also, open the game from a `file://` path: it should run without network errors (aside from RGS).  

8. **Validate Math/RTP:**  
   - *Fix:* Use the Stake Math SDK or other tools to simulate game spins (100k–1M iterations)【52†L328-L336】. Adjust game math so RTP falls in 90–98% and verifies desired hit frequency.  
   - *Verify:* After generating math files, extract RTP from `library/publish_files/index.json`:  
   ```bash
   cat library/publish_files/index.json | grep -o '"rtp":[0-9.]*'
   ```  
   – Check that the output is, for example, `"rtp":94.5`. Also ensure hit rates are reasonable.  

9. **Add All Disclaimers:**  
   - *Fix:* Include all mandatory disclaimer points (use the official wording if unsure)【127†L467-L475】. Place them in the info screen. For example:  
     - “Malfunctions void all wins and plays.”  
     - “A stable connection is required; reload to finish interrupted rounds.”  
     - “Expected return calculated over many plays.”  
     - Etc., including the payout source note and copyright.  
   - *Verify:* Search the code for keywords:  
   ```bash
   grep -R "Malfunctions void" -n src/
   grep -R "expected return" -n src/
   grep -R "Remote Game Server" -n src/
   ```  
   – Each required phrase should appear at least once.  

10. **Folder Structure & Upload Rules:**  
    - *Fix:* Assemble your submission folder as follows:  
      ```
      game/ 
        ├─ assets/          (image/audio files used by game)
        ├─ index.html       (entry point, correct meta, script include)
        ├─ library/ 
        │    └─ publish_files/ 
        │         ├ index.json (math config) 
        │         ├ (other math files) 
        └─ ... (other game files)
      ```  
      Stake expects an `index.json` under `library/publish_files/` listing the math assets【120†L0-L4】.  
    - *Verify:* After building, run:  
      ```bash
      ls game/library/publish_files
      ```  
      Ensure `index.json` and math assets are present. Also verify `index.html` references the correct game scripts.  

11. **CI/CD and Final Validation:**  
    - *Fix:* Integrate the above checks into your build pipeline. For example, use a pre-commit or CI script to run the grep/jq checks above.  
    - *Verify:* In your CI environment (e.g. GitHub Actions), include a job that fails if any grep returns a match (indicating a problem). Document this in your repo’s README.  

## Sample Verification Commands  

- **Asset Hosting Check:**  
  ```bash
  # Find any non-Stake URLs in built code
  grep -R "http://" -n build/ | grep -v "stakecdn.com" || echo "No external asset URLs"
  ```  
- **Static Content Scan:**  
  ```bash
  grep -R "<script src=" -n build/ || echo "No external scripts"
  grep -R "link rel=\"stylesheet\"" -n build/ | grep -v "stakecdn.com"
  ```  
- **RTP Value Extraction:**  
  ```bash
  jq '.rtp' game/library/publish_files/index.json
  ```  
  – Should output a number (e.g. `0.945`) representing the RTP.  
- **Disclaimer Presence:**  
  ```bash
  grep -R "Malfunctions void" -n game/
  grep -R "expected return" -n game/
  ```  
  Each must match a line in your game files.  

## QA Sign-Off Template  
```
**Stake Engine Submission QA Checklist**

Reviewer: __________________  Date: ______________

☑ Unique assets (no web-sdk samples) and all on Stake CDN  
☑ Game rules, paytable, RTP, and max win displayed in UI  
☑ UI includes balance, spacebar control, sound-off, autoplay-confirm  
☑ RGS Authenticate/Play/EndRound correctly implemented  
☑ Build is fully static (no external scripts/fonts)  
☑ Math simulation run; RTP ~90–98% (output attached)  
☑ `library/publish_files/index.json` present with math data  
☑ All required disclaimers included in info screen【127†L467-L475】  
☑ Accessibility: UI legible in mini-player/mobile view  
☑ CI checks (grep/jq) passed without issues

Approvals:
- Developer Lead: ____________
- QA Lead: ____________
- Stake Compliance Reviewer: ____________

Comments: ____________________________________________________
```  

## Checklist Item Mapping  

| Checklist Item                   | Source (URL)                            | Rationale                                           |
|----------------------------------|-----------------------------------------|-----------------------------------------------------|
| Unique assets (no samples)       | Frontend Requirements【110†L7-L9】       | “Web‑SDK sample games will not be approved.”【110†L7-L9】 |
| Assets on Stake CDN              | Frontend Requirements【110†L19-L21】     | “All images and fonts must be loaded from the Stake CDN.”【110†L19-L21】 |
| Rules/RTP shown in UI            | Frontend Requirements【110†L25-L32】     | “Detailed description of all game rules” and RTP must be accessible【110†L25-L32】 |
| UI controls (balance, spacebar…) | Frontend Requirements【110†L43-L51】【110†L61-L69】 | Must display balance, implement spacebar, etc.【110†L43-L51】【110†L61-L69】 |
| RGS API usage                    | RGS Requirements【57†L347-L355】         | “Session authentication…through the Stake Engine RGS.”【57†L347-L355】 |
| Static-only (no XSS)             | RGS Requirements【57†L361-L366】         | “Game must be fully static (cannot reach external sources).”【57†L361-L366】 |
| Math/RTP in range                | Math Requirements【52†L328-L336】       | Simulation required; expected RTP ~90–98%【52†L328-L336】 |
| All required disclaimers         | Disclaimer Template【127†L467-L475】    | Must include all listed points (malfunction, RTP, etc.)【127†L467-L475】 |
| Required files (index.json, etc) | (See documentation)                    | All game files (e.g., index.json) must be in `publish_files/`【120†L0-L4】 |

Each item above links to a Stake Engine doc or GitHub file showing the rule. By following these guidelines and using the provided verification steps (grep/jq examples, CI checks), you can ensure the game meets all submission criteria and avoids rejection.

**Sources:** Official Stake Engine documentation and GitHub repos【110†L7-L9】【127†L467-L475】【57†L361-L366】【52†L328-L336】.