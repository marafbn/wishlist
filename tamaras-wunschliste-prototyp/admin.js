(function () {
  const D = window.WishlistData;
  const supabase = window.wishlistSupabase;
  const BUCKET = "wish-images";

  const authPanel = document.querySelector("#auth-panel");
  const adminPanel = document.querySelector("#admin-panel");
  const authForm = document.querySelector("#auth-form");
  const wishesBox = document.querySelector("#admin-wishes");
  const form = document.querySelector("#wish-form");
  const imageInput = document.querySelector("#wish-image");

  let chosenFile = null;
  let previewObjectUrl = null;

  document.querySelector("#auth-title").textContent = "Admin-Anmeldung";
  document.querySelector("#auth-help").textContent =
    "Melde dich mit deiner Admin-E-Mail-Adresse und deinem Passwort an.";

  function showAuthMessage(message) {
    document.querySelector("#auth-message").textContent = message;
  }

  function clearTemporaryImage() {
    chosenFile = null;
    imageInput.value = "";

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  async function loadAdminWishes() {
    await D.loadWishesFromSupabase();
    renderAdminWishes();
  }

  function renderAdminWishes() {
    const wishes = D.getWishes().filter(
      (wish) => wish.status === "available",
    );

    document.querySelector("#wish-total").textContent =
      `${wishes.length} Wünsche`;

    wishesBox.innerHTML = wishes.length
      ? wishes
          .map(
            (wish) => `
              <article class="admin-wish-row">
                <div class="admin-thumb">
                  ${
                    wish.image
                      ? `<img src="${D.escapeHTML(wish.image)}" alt="">`
                      : `<span>${D.escapeHTML(wish.symbol || "GIFT")}</span>`
                  }
                </div>

                <div class="admin-wish-info">
                  <strong>${D.escapeHTML(wish.name)}</strong>
                  <span>
                    ${D.escapeHTML(wish.category)} /
                    ${D.money(wish.price)}
                  </span>
                </div>

                <div class="admin-row-actions">
                  <button
                    type="button"
                    class="text-button"
                    data-edit="${D.escapeHTML(wish.id)}"
                  >
                    Bearbeiten
                  </button>

                  <button
                    type="button"
                    class="text-button danger"
                    data-delete="${D.escapeHTML(wish.id)}"
                  >
                    Entfernen
                  </button>
                </div>
              </article>
            `,
          )
          .join("")
      : `<p class="empty-state">
           Noch keine verfügbaren Wünsche. Füge oben deinen ersten Wunsch hinzu.
         </p>`;
  }

  async function showAdmin() {
    authPanel.classList.add("is-hidden");
    adminPanel.classList.remove("is-hidden");

    try {
      await loadAdminWishes();
    } catch (error) {
      console.error("Admin-Wünsche konnten nicht geladen werden:", error);
      wishesBox.innerHTML =
        '<p class="empty-state">Wünsche konnten nicht geladen werden. Prüfe die Browser-Konsole.</p>';
    }
  }

  async function uploadWishImage(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Bitte wähle eine Bilddatei aus.");
    }

    const extension =
      file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";

    const uniqueName =
      window.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      throw new Error("Bitte melde dich erneut im Adminbereich an.");
    }

    const filePath = `${userData.user.id}/${uniqueName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return data.publicUrl;
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAuthMessage("");

    if (!supabase) {
      showAuthMessage("Die Supabase-Verbindung wurde nicht gefunden.");
      return;
    }

    const email = document.querySelector("#admin-email").value.trim();
    const password = document.querySelector("#admin-password").value;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Anmeldung fehlgeschlagen:", error);
        showAuthMessage(
          "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.",
        );
        return;
      }

      await showAdmin();
    } catch (error) {
      console.error("Anmeldung fehlgeschlagen:", error);
      showAuthMessage(`Anmeldung fehlgeschlagen: ${error.message}`);
    }
  });

  function resetForm() {
    form.reset();
    clearTemporaryImage();

    document.querySelector("#wish-id").value = "";
    document.querySelector("#save-wish").textContent = "Wunsch speichern";
    document.querySelector("#image-preview").classList.add("is-hidden");
    document.querySelector("#image-hint").textContent =
      "Noch kein Foto ausgewählt.";
    document.querySelector("#remove-image-wrap").classList.add("is-hidden");
    document.querySelector("#remove-image").checked = false;

    document.querySelector(
      'input[name="audience"][value="alle"]',
    ).checked = true;
  }

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    clearTemporaryImage();
    chosenFile = file;

    // Nach dem Zurücksetzen erneut in das Dateifeld schreiben.
    // Die Vorschau kommt aus einer temporären Browser-URL.
    const preview = document.querySelector("#image-preview");
    previewObjectUrl = URL.createObjectURL(file);
    preview.src = previewObjectUrl;
    preview.classList.remove("is-hidden");

    document.querySelector("#image-hint").textContent =
      "Neues Foto ausgewählt.";
    document.querySelector("#remove-image-wrap").classList.add("is-hidden");
    document.querySelector("#remove-image").checked = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = document.querySelector("#wish-id").value;
    const current = D.getWishes();
    const old = current.find(
      (wish) => String(wish.id) === String(id),
    );

    const audiences = [
      ...document.querySelectorAll('input[name="audience"]:checked'),
    ].map((input) => input.value);

    const removeImage = document.querySelector("#remove-image").checked;

    try {
      let image = old?.image || "";

      if (chosenFile) {
        image = await uploadWishImage(chosenFile);
      } else if (removeImage) {
        image = "";
      }

      const wishData = {
        title: document.querySelector("#wish-name").value.trim(),
        category: document.querySelector("#wish-category").value.trim(),
        price: Number(document.querySelector("#wish-price").value),
        description: document
          .querySelector("#wish-description")
          .value.trim(),
        image_url: image || null,
        gift_type: document.querySelector("#wish-type").value,
        audience: audiences.length ? audiences : ["alle"],
        shop_url:
          document.querySelector("#wish-link").value.trim() || null,
        status: "available",
      };

      if (id) {
        const { data, error } = await supabase
          .from("wishes")
          .update(wishData)
          .eq("id", id)
          .eq("status", "available")
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            "Kein verfügbarer Wunsch geändert. Vielleicht ist er inzwischen reserviert.",
          );
        }
      } else {
        const { error } = await supabase
          .from("wishes")
          .insert(wishData);

        if (error) throw error;
      }

      resetForm();
      await loadAdminWishes();
      window.alert("Wunsch gespeichert.");
    } catch (error) {
      console.error("Wunsch konnte nicht gespeichert werden:", error);
      window.alert(`Speichern fehlgeschlagen: ${error.message}`);
    }
  });

  wishesBox.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");

    if (editButton) {
      const wish = D.getWishes().find(
        (item) => String(item.id) === String(editButton.dataset.edit),
      );

      if (!wish) return;

      clearTemporaryImage();

      document.querySelector("#wish-id").value = wish.id;
      document.querySelector("#wish-name").value = wish.name;
      document.querySelector("#wish-category").value = wish.category;
      document.querySelector("#wish-price").value = wish.price;
      document.querySelector("#wish-type").value = wish.giftType;
      document.querySelector("#wish-description").value =
        wish.description || "";
      document.querySelector("#wish-link").value = wish.link || "";
      document.querySelector("#remove-image").checked = false;

      const audiences = Array.isArray(wish.audience) ? wish.audience : [];

      document
        .querySelectorAll('input[name="audience"]')
        .forEach((input) => {
          input.checked = audiences.includes(input.value);
        });

      if (!audiences.length) {
        document.querySelector(
          'input[name="audience"][value="alle"]',
        ).checked = true;
      }

      const preview = document.querySelector("#image-preview");

      if (wish.image) {
        preview.src = wish.image;
        preview.classList.remove("is-hidden");
        document.querySelector("#image-hint").textContent =
          "Aktuelles Foto.";
        document
          .querySelector("#remove-image-wrap")
          .classList.remove("is-hidden");
      } else {
        preview.classList.add("is-hidden");
        document.querySelector("#image-hint").textContent =
          "Noch kein Foto ausgewählt.";
        document
          .querySelector("#remove-image-wrap")
          .classList.add("is-hidden");
      }

      document.querySelector("#save-wish").textContent =
        "Änderungen speichern";

      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const deleteButton = event.target.closest("[data-delete]");

    if (
      deleteButton &&
      window.confirm("Diesen Wunsch wirklich entfernen?")
    ) {
      try {
        const { data, error } = await supabase
          .from("wishes")
          .delete()
          .eq("id", deleteButton.dataset.delete)
          .eq("status", "available")
          .select("id")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            "Kein verfügbarer Wunsch entfernt. Vielleicht ist er inzwischen reserviert.",
          );
        }

        await loadAdminWishes();
      } catch (error) {
        console.error("Wunsch konnte nicht entfernt werden:", error);
        window.alert(`Entfernen fehlgeschlagen: ${error.message}`);
      }
    }
  });

  document
    .querySelector("#cancel-edit")
    .addEventListener("click", resetForm);

  document
    .querySelector("#logout-button")
    .addEventListener("click", async () => {
      if (supabase) {
        const { error } = await supabase.auth.signOut();

        if (error) {
          window.alert(`Abmelden fehlgeschlagen: ${error.message}`);
          return;
        }
      }

      adminPanel.classList.add("is-hidden");
      authPanel.classList.remove("is-hidden");
      authForm.reset();
      showAuthMessage("");
    });

  async function restoreSession() {
    if (!supabase) {
      showAuthMessage("Die Supabase-Verbindung wurde nicht gefunden.");
      return;
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Sitzung konnte nicht geprüft werden:", error);
      showAuthMessage(`Sitzung konnte nicht geprüft werden: ${error.message}`);
      return;
    }

    if (data.session) {
      await showAdmin();
    }
  }

  restoreSession();
})();