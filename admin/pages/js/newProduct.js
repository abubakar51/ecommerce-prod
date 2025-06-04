function initNewProductForm() {
  const form = document.getElementById("productForm");
  const imageInput = document.getElementById("image");
  const imagePreview = document.getElementById("imagePreview");

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    if (!file.type.includes("jpeg")) {
      alert("Only JPG format is allowed.");
      imageInput.value = "";
      imagePreview.innerHTML = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      imagePreview.innerHTML = `<img src="${reader.result}" style="max-width: 150px; max-height: 150px;" />`;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const price = document.getElementById("price").value;
    const image = imageInput.files[0];
    const d_charge = document.getElementById("d_charge").value;
    if (!name || !price || !image || !image.name.endsWith(".jpg")) {
      alert("Please fill all fields correctly.");
      return;
    }

    // ✅ Convert image to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result.split(",")[1]; // remove data:image/jpeg;base64,

      const payload = {
        name,
        price,
        imageBase64: base64Image,
        d_charge,
      };

      document.getElementById("pageLoader").style.display = "flex";

      try {
        const res = await fetch("/api/addProduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        document.getElementById("pageLoader").style.display = "none";

        if (data.success) {
          form.reset();
          imagePreview.innerHTML = "";

          const modal = document.getElementById("customSuccessModal");
          modal.style.display = "flex";

          document.getElementById("closeModalBtn").onclick = () => {
            modal.style.display = "none";
          };
        } else {
          alert("❌ Failed to add product.");
        }
      } catch (err) {
        console.error("Error:", err);
        alert("Something went wrong.");
        document.getElementById("pageLoader").style.display = "none";
      }
    };

    reader.readAsDataURL(image); // ✅ triggers above reader.onloadend
  });
}
