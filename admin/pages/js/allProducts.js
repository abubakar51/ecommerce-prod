function initAllProductsTable() {
  let data = [];
  let rowsPerPage = 10;
  let currentPage = 1;
  let filteredData = [];
  const selectedIds = new Set();

  const tableBody = document.querySelector("#dataTable tbody");
  const pagination = document.getElementById("pagination");
  const searchInput = document.getElementById("searchInput");
  const summary = document.getElementById("selectionSummary");
  const selectedCount = document.getElementById("selectedCount");
  const selectAll = document.getElementById("selectAll");

  const modal = document.getElementById("confirmModal");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");

  fetch("/api/getAllProductsWithImages")
    .then((res) => res.json())
    .then((json) => {
      data = json;
      filteredData = [...data];
      renderTable();
    })
    .catch((err) => console.error("Failed to load product data:", err));

  function renderTable(page = 1) {
    currentPage = page;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);

    tableBody.innerHTML = pageData
      .map(
        (row, index) => `
        <tr style="background: #ffffff40;">
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6; text-align: center; vertical-align: middle;">
            <input style="border: 1px solid #333; width: 1.2rem;height: 1.2rem;" type="checkbox" class="row-check form-check-input" data-id="${
              row.id
            }" ${selectedIds.has(row.id) ? "checked" : ""}>
          </td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">${
            start + index + 1
          }</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;">
            <img src="/api/productImage/${
              row.id
            }" alt="Product Image" style="width: 4rem; height: 4rem; object-fit: cover;" />
          </td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;white-space: nowrap;">${
            row.name
          }</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;white-space: nowrap;">${
            row.price
          } BDT</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;white-space: nowrap;">${
            row.d_charge
          }Tk</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #dee2e6;white-space: nowrap;">#${
            row.id
          }</td>
        </tr>
      `
      )
      .join("");

    attachCheckboxListeners();
    renderPagination();
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    pagination.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="#" style="display: block; padding: 0.2rem 0.5rem; background: ${
        i === currentPage ? "#007bff" : "#f8f9fa"
      }; color: ${
        i === currentPage ? "#fff" : "#212529"
      }; border: 1px solid #dee2e6; border-radius: 4px; margin: 0 5px; text-decoration: none;" data-page="${i}">${i}</a>`;
      pagination.appendChild(li);
    }
  }

  pagination.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      e.preventDefault();
      const page = parseInt(e.target.dataset.page);
      if (!isNaN(page)) renderTable(page);
    }
  });

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    filteredData = data.filter((d) => d.name.toLowerCase().includes(term));
    renderTable(1);
  });

  document.getElementById("rowsPerPage").addEventListener("change", (e) => {
    rowsPerPage = parseInt(e.target.value);
    renderTable(1);
  });

  function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll(".row-check");
    checkboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id.toString();
        cb.checked ? selectedIds.add(id) : selectedIds.delete(id);
        selectAll.checked = false;
        updateSelection();
      });
    });

    selectAll.addEventListener("change", () => {
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      const pageData = filteredData.slice(start, end);
      pageData.forEach((row) => {
        if (selectAll.checked) selectedIds.add(row.id);
        else selectedIds.delete(row.id);
      });
      renderTable(currentPage);
      updateSelection();
    });
  }

  function updateSelection() {
    selectedCount.textContent = `${selectedIds.size} selected`;
  }

  document.getElementById("deleteBtn").addEventListener("click", () => {
    if (selectedIds.size > 0) {
      confirmMessage.textContent = `Are you sure to delete ${selectedIds.size} item(s)?`;
      modal.style.display = "flex";
    }
  });

  confirmNo.addEventListener("click", () => {
    modal.style.display = "none";
  });

  confirmYes.addEventListener("click", () => {
    const deletedIds = Array.from(selectedIds);
    data = data.filter((row) => !selectedIds.has(row.id));
    filteredData = [...data];
    selectedIds.clear();
    renderTable(1);
    updateSelection();
    modal.style.display = "none";

    fetch("/api/deleteProducts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: deletedIds }),
    })
      .then((res) => res.json())
      .then((msg) => console.log("✅ Products updated:", msg));
  });
}
