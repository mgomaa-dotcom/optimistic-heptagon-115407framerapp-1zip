/* Viewport-positioned top-layer menus stay anchored even inside transformed
   Framer sections. A flow-layout fallback avoids clipping in older browsers. */
export class BookingMenu {
  constructor(anchor, menu) {
    this.anchor = anchor;
    this.menu = menu;
    this.events = new AbortController();
    this.topLayer = typeof menu.showPopover === "function";
    if (this.topLayer) menu.setAttribute("popover", "manual");
    else menu.classList.add("menu-in-flow");
    const options = { signal: this.events.signal };
    window.addEventListener("resize", () => this.position(), options);
    window.addEventListener("scroll", () => this.position(), { ...options, capture: true });
    window.visualViewport?.addEventListener("resize", () => this.position(), options);
    window.visualViewport?.addEventListener("scroll", () => this.position(), options);
    document.addEventListener("pointerdown", event => {
      if (!event.composedPath().includes(anchor) && !event.composedPath().includes(menu)) this.close();
    }, options);
    document.addEventListener("mastery-menu-open", event => {
      if (event.detail !== this) this.close();
    }, options);
  }

  open() {
    document.dispatchEvent(new CustomEvent("mastery-menu-open", { detail: this }));
    this.menu.hidden = false;
    if (this.topLayer && !this.menu.matches(":popover-open")) this.menu.showPopover();
    this.anchor.setAttribute("aria-expanded", "true");
    this.position();
  }

  position() {
    if (this.menu.hidden || !this.topLayer) return;
    const rect = this.anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0;
    const topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const safe = 12;
    const gap = 6;
    const bottomEdge = topEdge + height;
    if (rect.bottom < topEdge || rect.top > bottomEdge) {
      this.close();
      return;
    }
    const menuWidth = Math.min(rect.width, width - 2 * safe);
    this.menu.style.width = `${menuWidth}px`;
    const below = Math.max(0, bottomEdge - rect.bottom - gap - safe);
    const above = Math.max(0, rect.top - topEdge - gap - safe);
    const desired = Math.min(230, this.menu.scrollHeight + 2);
    const downward = below >= Math.min(desired, 130) || below >= above;
    const menuHeight = Math.min(desired, downward ? below : above);
    this.menu.style.maxHeight = `${menuHeight}px`;
    this.menu.style.left = `${Math.max(leftEdge + safe,
      Math.min(rect.left, leftEdge + width - safe - menuWidth))}px`;
    this.menu.style.top = `${downward ? rect.bottom + gap : rect.top - gap - menuHeight}px`;
    this.menu.dataset.placement = downward ? "bottom" : "top";
  }

  close() {
    if (this.topLayer && this.menu.matches(":popover-open")) this.menu.hidePopover();
    this.menu.hidden = true;
    this.anchor.setAttribute("aria-expanded", "false");
    this.anchor.removeAttribute("aria-activedescendant");
  }

  destroy() {
    this.close();
    this.events.abort();
  }
}

export class EmployeePicker {
  constructor(root) {
    this.select = root.getElementById("booking-employees");
    this.trigger = root.getElementById("booking-employees-trigger");
    this.menu = root.getElementById("booking-employees-list");
    this.error = root.getElementById("error-employees");
    this.positioner = new BookingMenu(this.trigger, this.menu);
    this.active = -1;
    this.trigger.addEventListener("click", () => {
      if (this.menu.hidden) this.open();
      else this.close();
    });
    this.trigger.addEventListener("keydown", event => this.keydown(event));
    this.trigger.addEventListener("blur", () => this.close());
    this.menu.addEventListener("pointerdown", event => event.preventDefault());
    this.menu.addEventListener("click", event => {
      const option = event.target.closest("[data-employee-value]");
      if (option) this.choose(option.dataset.employeeValue);
    });
    this.select.addEventListener("change", () => this.sync());
    this.select.addEventListener("invalid", event => {
      event.preventDefault();
      this.trigger.setAttribute("aria-invalid", "true");
      this.error.textContent = "يرجى اختيار عدد الموظفين.";
      this.trigger.focus();
    });
    new MutationObserver(() => this.sync()).observe(this.select, {
      attributes: true, attributeFilter: ["disabled"], childList: true,
    });
    this.sync();
  }

  sync() {
    this.trigger.disabled = this.select.disabled;
    this.trigger.textContent = this.select.selectedOptions[0]?.textContent || "اختر عدد الموظفين";
    if (this.select.disabled) this.close();
  }

  open() {
    if (this.select.disabled) return;
    this.menu.replaceChildren();
    [...this.select.options].filter(option => option.value).forEach((option, index) => {
      const item = document.createElement("div");
      item.id = `employee-option-${index}`;
      item.className = "employee-option";
      item.dataset.employeeValue = option.value;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.textContent = option.textContent;
      this.menu.append(item);
    });
    this.active = [...this.menu.children].findIndex(item =>
      item.dataset.employeeValue === this.select.value);
    this.positioner.open();
    this.highlight();
  }

  highlight() {
    [...this.menu.children].forEach((item, index) => item.classList.toggle("is-active", index === this.active));
    const item = this.menu.children[this.active];
    if (item) {
      this.trigger.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  }

  choose(value) {
    this.select.value = value;
    this.select.dispatchEvent(new Event("change", { bubbles: true }));
    this.trigger.removeAttribute("aria-invalid");
    this.error.textContent = "";
    this.close();
  }

  close() { this.positioner.close(); }

  keydown(event) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (this.menu.hidden) this.open();
      const length = this.menu.children.length;
      if (!length) return;
      if (event.key === "Home") this.active = 0;
      else if (event.key === "End") this.active = length - 1;
      else this.active = (this.active + (event.key === "ArrowDown" ? 1 :
        this.active === -1 ? 0 : -1) + length) % length;
      this.highlight();
    } else if (["Enter", " "].includes(event.key) && !this.menu.hidden) {
      event.preventDefault();
      const item = this.menu.children[this.active];
      if (item) this.choose(item.dataset.employeeValue);
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      this.close();
    }
  }
}
