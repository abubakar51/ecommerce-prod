function initAllOrdersTable() {
  let data = [];
  let filteredData = [];
  let rowsPerPage = 10;
  let currentPage = 1;
  const selectedIds = new Set();

  const tableBody = document.querySelector("#dataTable tbody");
  const pagination = document.getElementById("pagination");
  const searchInput = document.getElementById("searchInput");
  const summary = document.getElementById("selectedCount");
  const selectAll = document.getElementById("selectAll");

  const modal = document.getElementById("confirmModal");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");
  fetch("/api/allOrders")
    .then((res) => res.json())
    .then((orders) => {
      data = orders;
      filteredData = [...data];
      renderTable();
    });

  function renderTable(page = 1) {
    currentPage = page;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);

    tableBody.innerHTML = pageData
      .map((row, index) => {
        const created = new Date(row.created_at);
        const id = row.order_id;

        return `
        <tr style="background: #ffffff40;">
          <td style="white-space: nowrap; "><input type="checkbox" style="border: 1px solid #333;" class="row-check form-check-input" data-id="${id}" ${
          selectedIds.has(id) ? "checked" : ""
        }></td>
          <td style="white-space: nowrap">${start + index + 1}</td>
          <td style="white-space: nowrap"><a href="/previewOrder/${
            row.order_id
          }" target="_blank">#${row.order_id}</a></td>
          <td style="white-space: nowrap">${row.name}</td>
          <td style="white-space: nowrap">${row.mobile}</td>
          <td style="white-space: nowrap">${row.product_name}</td>
          <td style="white-space: nowrap">${row.p_price} BDT</td>
          <td style="white-space: nowrap">${row.qty}</td>
          <td style="white-space: nowrap"><input type="text" class="form-control d-charge-input" data-id="${id}" style="width: 60px; display: inline-block; padding-left: 0px; padding-right: 0px; text-align: center;" value="${
          row.d_charge
        }"/> Tk</td>
          <td style="white-space: nowrap">${
            parseFloat(row.p_price) * parseFloat(row.qty) +
            parseFloat(row.d_charge)
          } BDT</td>
          <td style="white-space: nowrap">${row.address}</td>
          <td style="white-space: nowrap">
            <select class="form-select form-select-sm status-dropdown" data-id="${id}" style="width: 115px">
              <option value="pending" ${
                row.status === "pending" ? "selected" : ""
              }>Pending</option>
              <option value="complete" ${
                row.status === "complete" ? "selected" : ""
              }>Complete</option>
              <option value="canceled" ${
                row.status === "canceled" ? "selected" : ""
              }>Canceled</option>
            </select>
          </td>
          <td style="white-space: nowrap;"><span class="countdown" data-status="${
            row.status
          }" data-created="${created.toISOString()}">--:--</span></td>
        </tr>`;
      })
      .join("");

    attachListeners();
    renderPagination();
    updateSelection();
  }

  function attachListeners() {
    document.querySelectorAll(".row-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateSelection();
      });
    });

    document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
      dropdown.addEventListener("change", () => {
        const order_id = dropdown.dataset.id;
        const status = dropdown.value;
        fetch("/api/updateStatus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id, status }),
        });
      });
    });
    document.querySelectorAll(".d-charge-input").forEach((input) => {
      const orderId = input.dataset.id;
      let originalValue = input.value.trim();

      input.addEventListener("blur", () => {
        const newValue = input.value.trim();

        if (newValue !== originalValue) {
          fetch("/api/updateDeliveryCharge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ order_id: orderId, d_charge: newValue }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                originalValue = newValue; // আপডেট সফল হলে নতুন value ধরে রাখো
                const priceCell = input
                  .closest("tr")
                  .querySelector("td:nth-child(10)");
                const productPrice = parseFloat(
                  input.closest("tr").querySelector("td:nth-child(7)")
                    .textContent
                );
                const qty = parseInt(
                  input.closest("tr").querySelector("td:nth-child(8)")
                    .textContent
                );
                const dCharge = parseFloat(newValue);

                const newTotal = productPrice * qty + dCharge;
                priceCell.textContent = `${newTotal} BDT`;
              } else {
                console.error(
                  "❌ Update failed:",
                  data.error || "Unknown error"
                );
              }
            })
            .catch((err) => {
              console.error("❌ Network error:", err);
            });
        }
      });
    });
  }

  function updateSelection() {
    summary.textContent = `${selectedIds.size} selected`;
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    pagination.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = i;
      a.dataset.page = i;
      a.style.padding = "5px 10px";
      a.style.border = "1px solid #ccc";
      a.style.borderRadius = "4px";
      a.style.margin = "0 4px";
      a.style.textDecoration = "none";
      a.style.color = i === currentPage ? "white" : "#333";
      a.style.background = i === currentPage ? "#007bff" : "#f1f1f1";
      a.style.cursor = "pointer";
      pagination.appendChild(a);
    }
  }

  pagination.addEventListener("click", (e) => {
    if (e.target.dataset.page) {
      e.preventDefault();
      renderTable(parseInt(e.target.dataset.page));
    }
  });

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    filteredData = data.filter((d) => d.mobile.includes(term));
    renderTable(1);
  });

  document.getElementById("rowsPerPage").addEventListener("change", (e) => {
    rowsPerPage = parseInt(e.target.value);
    renderTable(1);
  });

  selectAll.addEventListener("change", () => {
    const pageData = filteredData.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
    pageData.forEach((row) => {
      if (selectAll.checked) selectedIds.add(row.order_id);
      else selectedIds.delete(row.order_id);
    });
    renderTable(currentPage);
  });

  document.getElementById("deleteBtn").addEventListener("click", () => {
    const count = selectedIds.size;
    if (count > 0) {
      confirmMessage.textContent = `Are you sure to delete ${count} item${
        count > 1 ? "s" : ""
      }?`;
      modal.style.display = "flex";
    }
  });

  confirmNo.addEventListener("click", () => {
    modal.style.display = "none";
  });

  confirmYes.addEventListener("click", () => {
    const ids = Array.from(selectedIds);
    fetch("/api/deleteOrders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.json())
      .then(() => location.reload());
  });

  setInterval(() => {
    document.querySelectorAll(".countdown").forEach((el) => {
      const status = el.dataset.status;
      if (status === "complete" || status === "canceled") {
        el.textContent = "-";
        return;
      }

      const createdAt = new Date(el.dataset.created);
      const now = new Date();
      let diff = Math.floor((now - createdAt) / 1000);

      const days = Math.floor(diff / (60 * 60 * 24));
      diff %= 60 * 60 * 24;
      const hours = Math.floor(diff / 3600);
      diff %= 3600;
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;

      const format = (n) => n.toString().padStart(2, "0");

      el.textContent =
        (days > 0 ? format(days) + ":" : "") +
        format(hours) +
        ":" +
        format(mins) +
        ":" +
        format(secs);
    });
  }, 1000);
}
