(function () {
  "use strict";

  const cfg = window.KAIDA_CONFIG || {};

  function normalizePhone(raw) {
    if (!raw) return "";
    let s = String(raw).trim().replace(/[^\d+]/g, "");
    if (s.startsWith("00")) s = "+" + s.slice(2);
    if (!s.startsWith("+")) {
      const digits = s.replace(/\D/g, "");
      if (digits.length === 10) s = "+1" + digits;
      else s = "+" + digits;
    }
    return "+" + s.replace(/\D/g, "");
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
  }

  function apiReady() {
    return cfg.API_URL && !cfg.API_URL.includes("PASTE_YOUR_");
  }

  async function callApi(action, payload = {}) {
    if (!apiReady()) {
      throw new Error("The site is not connected to the KAIDA Google Apps Script backend yet. Update config.js first.");
    }

    const response = await fetch(cfg.API_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }

  function setMessage(el, text, kind = "info") {
    if (!el) return;
    el.textContent = text;
    el.className = `notice notice-${kind}`;
    el.hidden = !text;
  }

  function qs(id) { return document.getElementById(id); }

  async function handleLookup(event) {
    event.preventDefault();
    const phone = normalizePhone(qs("lookupPhone").value);
    const msg = qs("lookupMessage");
    const card = qs("memberCard");
    setMessage(msg, "Looking up your KAIDA membership...", "info");
    card.hidden = true;

    try {
      const data = await callApi("lookupMember", { phone });
      if (!data.member) {
        setMessage(msg, "No KAIDA member was found with that phone number. If you are new, use New Member Registration.", "warning");
        return;
      }

      const m = data.member;
      qs("memberId").value = m.memberId || "";
      qs("memberName").value = m.name || "";
      qs("memberPhone").value = m.phone || phone;
      qs("memberTown").value = m.town || "";
      qs("memberChiefdom").value = m.chiefdom || "";
      qs("memberEmail").value = m.email || "";
      qs("memberState").value = m.state || "";
      qs("memberLookupKey").value = phone;
      qs("memberStatusText").textContent = m.status || "Active";
      setMessage(msg, `Member found: ${m.name || m.memberId}. You may update the editable information below.`, "success");
      card.hidden = false;
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    const msg = qs("updateMessage");
    setMessage(msg, "Saving your changes...", "info");
    const payload = {
      memberId: qs("memberId").value,
      lookupPhone: qs("memberLookupKey").value,
      name: qs("memberName").value.trim(),
      phone: normalizePhone(qs("memberPhone").value),
      town: qs("memberTown").value.trim(),
      chiefdom: qs("memberChiefdom").value.trim(),
      email: qs("memberEmail").value.trim(),
      state: qs("memberState").value.trim()
    };

    try {
      const data = await callApi("updateMember", payload);
      setMessage(msg, data.message || "Your KAIDA membership information was updated successfully.", "success");
      qs("memberLookupKey").value = payload.phone;
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  async function handleRegistration(event) {
    event.preventDefault();
    const msg = qs("registerMessage");
    setMessage(msg, "Submitting your registration...", "info");

    const payload = {
      name: qs("regName").value.trim(),
      phone: normalizePhone(qs("regPhone").value),
      town: qs("regTown").value.trim(),
      chiefdom: qs("regChiefdom").value.trim(),
      email: qs("regEmail").value.trim(),
      state: qs("regState").value.trim()
    };

    try {
      const data = await callApi("registerMember", payload);
      setMessage(msg, data.message || "Registration submitted successfully.", "success");
      event.target.reset();
    } catch (err) {
      setMessage(msg, err.message, err.message.toLowerCase().includes("already") ? "warning" : "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const year = qs("year");
    if (year) year.textContent = new Date().getFullYear();

    const lookupForm = qs("lookupForm");
    if (lookupForm) lookupForm.addEventListener("submit", handleLookup);

    const updateForm = qs("updateForm");
    if (updateForm) updateForm.addEventListener("submit", handleUpdate);

    const registerForm = qs("registerForm");
    if (registerForm) registerForm.addEventListener("submit", handleRegistration);

    document.querySelectorAll("[data-registration-fee]").forEach(el => el.textContent = money(cfg.REGISTRATION_FEE || 50));
    document.querySelectorAll("[data-monthly-dues]").forEach(el => el.textContent = money(cfg.MONTHLY_DUES || 10));
  });

  window.KAIDA = { normalizePhone, callApi, money };
})();
