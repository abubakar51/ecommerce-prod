function initNodeMailer() {
  const gmailInput = document.getElementById("gmail");
  const passwordInput = document.getElementById("app_password");
  const alertBox = document.getElementById("alertBox");
  const saveButton = document.getElementById("saveBtn");

  // Show Bootstrap-style alert with custom message and type
  function showAlert(message, type = "info") {
    alertBox.innerHTML = message;
    alertBox.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertBox.style.display = "block";
    setTimeout(() => {
      alertBox.style.display = "none";
      alertBox.className = "";
      alertBox.innerHTML = "";
    }, 4000);
  }

  // Fetch existing credentials and populate input fields
  async function loadCredentials() {
    try {
      const res = await fetch("/api/getNodemailer");
      const data = await res.json();
      if (res.ok) {
        gmailInput.value = data.gmail || "";
        passwordInput.value = data.app_password || "";
      } else {
        showAlert("Failed to load credentials", "warning");
      }
    } catch (err) {
      showAlert("Server error while loading data.", "danger");
    }
  }

  // Save credentials to the server
  async function saveCredentials() {
    const gmail = gmailInput.value.trim();
    const app_password = passwordInput.value.trim();

    if (!gmail || !app_password) {
      showAlert("Both Gmail and App Password are required.", "danger");
      return;
    }

    try {
      const res = await fetch("/api/nodemailer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmail, app_password }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || "Saved successfully!", "success");
      } else {
        showAlert(data.error || "Failed to save credentials.", "danger");
      }
    } catch (err) {
      showAlert("Network error. Please try again later.", "danger");
    }
  }

  // Attach event listeners
  saveButton.addEventListener("click", saveCredentials);

  // Initial load
  loadCredentials();
}
