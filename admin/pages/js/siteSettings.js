function initSiteSettings() {
  const form = document.getElementById("siteSettingsForm");

  const siteName = document.getElementById("siteName");
  const logoUpload = document.getElementById("logoUpload");
  const faviconUpload = document.getElementById("faviconUpload");
  const headerTitle = document.getElementById("headerTitle");
  const productSectionTitle = document.getElementById("productSectionTitle");
  const showSearch = document.getElementById("showSearch");
  const showSiteName = document.getElementById("showSiteName");
  const showLogo = document.getElementById("showLogo");
  const bannerTitle = document.getElementById("bannerTitle");
  const bannerImage = document.getElementById("bannerImage");

  // ✅ Load site settings from database
  fetch("/api/siteSettings")
    .then((res) => res.json())
    .then(({ success, settings }) => {
      if (success) {
        siteName.value = settings.siteName || "";
        headerTitle.value = settings.headerTitle || "";
        productSectionTitle.value = settings.productSectionTitle || "";
        showSearch.checked = settings.searchBar === "true";
        bannerTitle.value = settings.bannerTitle || "";
        showSiteName.checked = settings.show_site_name === "true";
        showLogo.checked = settings.show_logo === "true";

        document.getElementById("logoPreview").src = "/api/siteImageGet/logo";
        document.getElementById("faviconPreview").src =
          "/api/siteImageGet/favicon";
        document.getElementById("bannerPreview").src =
          "/api/siteImageGet/banner";
      }
    })
    .catch((err) => console.error("❌ Failed to load site settings:", err));

  // ✅ Submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const updatedSettings = {
      siteName: siteName.value.trim(),
      headerTitle: headerTitle.value.trim(),
      productSectionTitle: productSectionTitle.value.trim(),
      searchBar: showSearch.checked.toString(),
      bannerTitle: bannerTitle.value.trim(),
      show_site_name: showSiteName.checked.toString(),
      show_logo: showLogo.checked.toString(),
    };

    try {
      const settingsRes = await fetch("/api/updateSiteSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });

      if (!settingsRes.ok) throw new Error("Failed to save site settings.");

      const uploadPromises = [];
      if (logoUpload.files[0])
        uploadPromises.push(uploadImage("logo", logoUpload.files[0]));
      if (faviconUpload.files[0])
        uploadPromises.push(uploadImage("favicon", faviconUpload.files[0]));
      if (bannerImage.files[0])
        uploadPromises.push(uploadImage("banner", bannerImage.files[0]));

      await Promise.all(uploadPromises);
      alert("✅ Settings saved successfully!");
    } catch (err) {
      console.error("❌ Error saving settings:", err);
      alert("❌ Failed to save settings.");
    }
  });

  function uploadImage(id, file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const res = await fetch(`/api/siteImage/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: reader.result }),
          });
          if (!res.ok) throw new Error("Failed to upload image");
          resolve();
        } catch (err) {
          console.error(`❌ Failed to upload ${id} image:`, err);
          reject(err);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  loadHeaderButtons();
}

function loadHeaderButtons() {
  fetch("/api/siteHeaderButtons")
    .then((res) => res.json())
    .then((data) => {
      const list = document.getElementById("headerButtonsList");
      list.innerHTML = "";
      if (data.success) {
        data.buttons.forEach((btn) => {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center";
          li.innerHTML = `
            <div><strong>${btn.text}</strong> — <small>${btn.link}</small></div>
            <button class="btn btn-sm btn-danger" onclick="deleteHeaderButton(${btn.id})">
              <i class="bi bi-trash"></i>
            </button>`;
          list.appendChild(li);
        });
      }
    });
}

function addHeaderButton() {
  const text = document.getElementById("newButtonText").value.trim();
  const link = document.getElementById("newButtonLink").value.trim();
  if (!text || !link) return alert("Text and link required");

  fetch("/api/siteHeaderButtons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, link }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        document.getElementById("newButtonText").value = "";
        document.getElementById("newButtonLink").value = "";
        loadHeaderButtons();
      } else {
        alert("❌ Failed to add button");
      }
    });
}

function deleteHeaderButton(id) {
  fetch(`/api/siteHeaderButtons/${id}`, { method: "DELETE" })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) loadHeaderButtons();
    });
}
