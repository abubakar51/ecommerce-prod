function initDashboardCount() {
  fetch("/api/getAllProductsWithImages")
    .then((res) => res.json())
    .then((products) => {
      const el = document.getElementById("productCount");
      if (el) el.textContent = products.length;
    });

  setInterval(() => {
    fetch("/api/allOrders")
      .then((res) => res.json())
      .then((orders) => {
        const total = orders.length;
        const complete = orders.filter((o) => o.status === "complete").length;
        const pending = orders.filter((o) => o.status === "pending").length;
        const canceled = orders.filter((o) => o.status === "canceled").length;

        const orderEl = document.getElementById("orderCount");
        const completeEl = document.getElementById("completeCount");
        const pendingEl = document.getElementById("pendingCount");
        const canceledEl = document.getElementById("canceledCount");

        if (orderEl) orderEl.textContent = total;
        if (completeEl) completeEl.textContent = complete;
        if (pendingEl) pendingEl.textContent = pending;
        if (canceledEl) canceledEl.textContent = canceled;
      });
  }, 1000);
}
