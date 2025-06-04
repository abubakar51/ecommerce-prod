function initAdminProfile() {
  const form = document.getElementById("adminProfileForm");
  const nameInput = document.getElementById("adminName");
  const emailInput = document.getElementById("adminEmail");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const profileInput = document.getElementById("profilePicInput");
  const profilePreview = document.getElementById("profilePreview");
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const overlay = document.getElementById("hoverOverlay");
  const togglePassword = document.getElementById("togglePassword");

  let editMode = false;
  let selectedImageBase64 = "";
  let isImageChanged = false;
  // ✅ Load profile data
  fetch("/api/admin/profile")
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        const profile = data.profile;
        nameInput.value = profile.name || "";
        emailInput.value = profile.email || "";
        usernameInput.value = profile.username || "";
        passwordInput.value = profile.password || "";

        // Load profile image from image route (not raw base64)
        profilePreview.src = "/api/admin/profilePic";
      }
    });

  // ✅ Toggle Edit Mode
  editBtn.addEventListener("click", () => {
    editMode = true;
    [nameInput, emailInput, usernameInput, passwordInput].forEach((el) => {
      el.disabled = false;
    });
    editBtn.style.display = "none";
    saveBtn.style.display = "inline-block";
  });

  // ✅ Hover overlay logic
  const wrapper = overlay.parentElement;
  wrapper.addEventListener("mouseenter", () => {
    if (editMode) {
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
      overlay.style.cursor = "pointer";
    }
  });
  wrapper.addEventListener("mouseleave", () => {
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
  });

  overlay.addEventListener("click", () => {
    if (editMode) {
      profileInput.click();
    }
  });

  // ✅ Toggle password visibility
  togglePassword.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type");
    passwordInput.setAttribute(
      "type",
      type === "password" ? "text" : "password"
    );
    togglePassword.classList.toggle("bi-eye");
    togglePassword.classList.toggle("bi-eye-slash");
  });

  // ✅ Preview selected image & keep base64
  profileInput.addEventListener("change", () => {
    const file = profileInput.files[0];
    if (file) {
      const reader = new FileReader();
      saveBtn.disabled = true;
      reader.onload = () => {
        profilePreview.src = reader.result;
        selectedImageBase64 = reader.result;
        isImageChanged = true;
        saveBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    }
  });

  // ✅ Save updated profile
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const updatedData = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      username: usernameInput.value.trim(),
      password: passwordInput.value.trim(),
      profilePicBase64: isImageChanged ? selectedImageBase64 : null, // if empty, retain old
    };

    const res = await fetch("/api/admin/updateProfile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });

    const result = await res.json();

    if (result.success) {
      alert("✅ Profile updated successfully!");
      editMode = false;
      [nameInput, emailInput, usernameInput, passwordInput].forEach(
        (el) => (el.disabled = true)
      );
      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      // Reload image from server (not base64)
      profilePreview.src = "/api/admin/profilePic?ts=" + Date.now(); // prevent caching
    } else {
      alert("❌ Failed to update profile.");
    }
  });
}
