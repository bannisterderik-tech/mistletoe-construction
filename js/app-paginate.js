/* MCPager — tiny, consistent client-side paginator for the CRM tables.
   Keeps each page's own row-rendering; it just feeds a slice + draws controls.

   var pager = MCPager({ controls: el, pageSize: 25, onPage: function(slice){ ...render slice... } });
   pager.set(items);     // render current page (clamps if out of range)
   pager.first();        // jump to page 0 (call before set() on search/filter change)
*/
(function () {
  function MCPager(opts) {
    opts = opts || {};
    var pageSize = opts.pageSize || 25;
    var controls = opts.controls || null;
    var onPage = opts.onPage || function () {};
    var page = 0;
    var items = [];

    function pages() { return Math.max(1, Math.ceil(items.length / pageSize)); }

    function drawControls() {
      if (!controls) return;
      if (items.length <= pageSize) { controls.innerHTML = ""; controls.hidden = true; return; }
      controls.hidden = false;
      var from = items.length ? page * pageSize + 1 : 0;
      var to = Math.min(items.length, (page + 1) * pageSize);
      controls.innerHTML =
        "<button type='button' class='btn btn-ghost btn-sm' data-pg='prev'" + (page === 0 ? " disabled" : "") + ">← Prev</button>" +
        "<span class='mc-pager-range'>" + from + "–" + to + " of " + items.length + "</span>" +
        "<button type='button' class='btn btn-ghost btn-sm' data-pg='next'" + (page >= pages() - 1 ? " disabled" : "") + ">Next →</button>";
    }

    function draw() {
      var start = page * pageSize;
      onPage(items.slice(start, start + pageSize), { page: page, pages: pages(), total: items.length });
      drawControls();
    }

    if (controls) controls.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pg]"); if (!b) return;
      var dir = b.getAttribute("data-pg");
      if (dir === "prev" && page > 0) page--;
      else if (dir === "next" && page < pages() - 1) page++;
      else return;
      draw();
      // keep the table in view when paging on long pages
      if (controls.scrollIntoView) controls.scrollIntoView({ block: "nearest" });
    });

    return {
      set: function (newItems) {
        items = newItems || [];
        if (page >= pages()) page = pages() - 1;
        if (page < 0) page = 0;
        draw();
      },
      first: function () { page = 0; },
      pageSize: function () { return pageSize; }
    };
  }
  window.MCPager = MCPager;
})();
