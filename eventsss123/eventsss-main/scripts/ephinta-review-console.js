/* EPHINTA Visual Review Console
 * Paste this file's contents into the browser DevTools Console while EPHINTA is open.
 * Feedback remains in this tab until exported. Screenshots are captured with Win+Shift+S.
 */
(() => {
  const existing = document.getElementById("ephinta-review-tool");
  if (existing) existing.remove();

  const feedback = [];
  const root = document.createElement("div");
  root.id = "ephinta-review-tool";
  root.innerHTML = `
    <style>
      #ephinta-review-tool{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:14px/1.4 Arial,sans-serif}
      #ephinta-review-tool *{box-sizing:border-box}
      #ephinta-review-tool .launcher{position:fixed;right:18px;top:18px;pointer-events:auto;background:#173b70;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;box-shadow:0 3px 14px #0003}
      #ephinta-review-tool .panel{display:none;position:fixed;right:18px;top:66px;width:min(400px,calc(100vw - 36px));max-height:86vh;overflow:auto;pointer-events:auto;background:#fff;color:#172033;border-radius:12px;padding:17px;box-shadow:0 8px 35px #0005}
      #ephinta-review-tool h3{margin:0 0 8px;font-size:18px}
      #ephinta-review-tool .hint{color:#667085;font-size:12px}
      #ephinta-review-tool label{display:block;margin:11px 0 5px;font-size:12px;font-weight:700}
      #ephinta-review-tool input,#ephinta-review-tool textarea,#ephinta-review-tool select{display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#172033;font:13px Arial}
      #ephinta-review-tool textarea{min-height:70px;resize:vertical}
      #ephinta-review-tool .actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
      #ephinta-review-tool button.action{border:0;border-radius:7px;padding:10px 12px;cursor:pointer;font-weight:700}
      #ephinta-review-tool .primary{background:#173b70;color:#fff}
      #ephinta-review-tool .secondary{background:#e8edf5;color:#172033}
      #ephinta-review-tool .entry{margin-top:8px;padding:9px;background:#f1f5f9;border-radius:7px;font-size:12px;overflow-wrap:anywhere}
      #ephinta-review-tool .status{margin-top:8px;font-size:12px;color:#17623b}
    </style>
    <button type="button" class="launcher">EPHINTA REVIEW</button>
    <section class="panel" role="dialog" aria-label="EPHINTA visual review">
      <h3>EPHINTA Visual Review</h3>
      <p class="hint">Record a correction on each screen. Export the report and attach screenshots taken with Windows + Shift + S.</p>
      <label for="epr-stage">Screen / stage</label>
      <select id="epr-stage">
        <option>Landing page</option><option>Registration</option><option>Sign in</option>
        <option>Customer dashboard</option><option>Planner dashboard</option><option>Vendor dashboard</option>
        <option>Marketplace</option><option>Event creation</option><option>Payments</option>
        <option>Wallet</option><option>Messages</option><option>Profile / Settings</option><option>Other</option>
      </select>
      <label for="epr-category">Problem category</label>
      <select id="epr-category">
        <option>Visual / Layout</option><option>Button / Navigation</option><option>Functionality</option>
        <option>Mobile responsiveness</option><option>Authentication / Security</option>
        <option>Payment</option><option>Performance</option><option>Content / Text</option><option>Other</option>
      </select>
      <label for="epr-problem">What is wrong?</label>
      <textarea id="epr-problem" placeholder="Describe what you see..."></textarea>
      <label for="epr-expected">What should happen instead?</label>
      <textarea id="epr-expected" placeholder="Describe the correction..."></textarea>
      <div class="actions">
        <button type="button" class="action primary" id="epr-add">Save feedback</button>
        <button type="button" class="action secondary" id="epr-copy">Copy report</button>
        <button type="button" class="action secondary" id="epr-download">Download JSON</button>
        <button type="button" class="action secondary" id="epr-close">Close panel</button>
      </div>
      <div class="entry" id="epr-count">Feedback collected: 0</div>
      <div id="epr-entries"></div>
      <div class="status" id="epr-status" aria-live="polite"></div>
      <p class="hint">Do not enter passwords, PINs, card numbers, or payment credentials. Nothing is sent automatically.</p>
    </section>`;
  document.body.appendChild(root);

  const q = (selector) => root.querySelector(selector);
  const panel = q(".panel");
  const status = q("#epr-status");
  const setStatus = (message) => { status.textContent = message; };

  q(".launcher").addEventListener("click", () => {
    panel.style.display = panel.style.display === "block" ? "none" : "block";
  });
  q("#epr-close").addEventListener("click", () => { panel.style.display = "none"; });

  const render = () => {
    q("#epr-count").textContent = `Feedback collected: ${feedback.length}`;
    const list = q("#epr-entries");
    list.replaceChildren();
    feedback.forEach((item, index) => {
      const entry = document.createElement("div");
      entry.className = "entry";
      entry.textContent = `${index + 1}. ${item.stage} — ${item.category}: ${item.problem}`;
      list.appendChild(entry);
    });
  };

  const makeReport = () => JSON.stringify({
    application: "EPHINTA",
    exportedAt: new Date().toISOString(),
    currentPage: location.href,
    pageTitle: document.title,
    feedbackCount: feedback.length,
    feedback
  }, null, 2);

  q("#epr-add").addEventListener("click", () => {
    const problem = q("#epr-problem").value.trim();
    if (!problem) { setStatus("Enter a description before saving."); return; }
    feedback.push({
      stage: q("#epr-stage").value,
      category: q("#epr-category").value,
      problem,
      expected: q("#epr-expected").value.trim(),
      page: location.href,
      title: document.title,
      viewport: `${innerWidth}x${innerHeight}`,
      recordedAt: new Date().toISOString()
    });
    q("#epr-problem").value = "";
    q("#epr-expected").value = "";
    render();
    setStatus("Feedback saved in this browser tab.");
  });

  q("#epr-copy").addEventListener("click", async () => {
    const report = makeReport();
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Report copied. Paste it into ChatGPT.");
    } catch {
      const field = document.createElement("textarea");
      field.value = report;
      field.style.cssText = "position:fixed;left:-9999px;top:0";
      root.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      setStatus(copied ? "Report copied. Paste it into ChatGPT." : "Clipboard blocked. Use Download JSON instead.");
    }
  });

  q("#epr-download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([makeReport()], {type:"application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "EPHINTA-Review-Feedback.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Feedback JSON downloaded.");
  });

  window.EPHINTA_REVIEW = {
    feedback,
    export: makeReport,
    close: () => root.remove()
  };
  render();
  setStatus("Review panel ready. Use Win + Shift + S for screenshots.");
  console.info("EPHINTA Review installed. Click the blue button at the top-right.");
})();
