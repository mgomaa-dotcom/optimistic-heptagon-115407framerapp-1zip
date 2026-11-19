/* Searchable, keyboard-accessible country selection inside the booking shadow root. */
import { BookingMenu } from "./assets/js/booking-menu.js";

export class CountryPicker {
  constructor(root, countries) {
    this.wrapper = root.querySelector(".country-picker");
    this.input = root.getElementById("booking-country-search");
    this.value = root.getElementById("booking-country");
    this.menu = root.getElementById("booking-country-list");
    this.positioner = new BookingMenu(this.input, this.menu);
    this.announcement = root.getElementById("country-search-status");
    this.countries = [...countries].sort((a, b) =>
      a.code === "SA" ? -1 : b.code === "SA" ? 1 : a.name.localeCompare(b.name));
    const names = new Intl.DisplayNames(["ar"], { type: "region" });
    this.countries.forEach((country) => {
      country.label = `${country.flag ? country.flag + " " : ""}${country.name}`;
      country.searchName = country.isoCode ? names.of(country.isoCode) : country.name;
    });
    this.active = -1;
    this.input.disabled = false;
    this.input.setCustomValidity("يرجى اختيار الدولة من القائمة.");
    this.input.addEventListener("focus", () => this.open(this.value.value ? "" : this.input.value));
    this.input.addEventListener("input", () => {
      const query = this.input.value.trim().toLocaleLowerCase();
      const exact = this.countries.find((item) => [
        item.name, item.label, item.searchName, item.code,
      ].some((text) => text.toLocaleLowerCase() === query));
      this.value.value = exact?.code || "";
      this.input.setCustomValidity(exact ? "" : "يرجى اختيار الدولة من القائمة.");
      this.input.removeAttribute("aria-invalid");
      this.open(this.input.value);
    });
    this.input.addEventListener("keydown", (event) => this.keydown(event));
    this.input.addEventListener("blur", () => this.close());
    this.menu.addEventListener("pointerdown", (event) => event.preventDefault());
    this.menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-country-index]");
      if (option) this.choose(Number(option.dataset.countryIndex));
    });
  }

  open(query = "") {
    if (this.input.disabled) return;
    const needle = query.trim().toLocaleLowerCase();
    this.filtered = this.countries.filter((item) =>
      [item.name, item.label, item.searchName, item.code].some((text) =>
        text.toLocaleLowerCase().includes(needle)));
    this.menu.replaceChildren();
    this.filtered.forEach((country, index) => {
      const option = document.createElement("div");
      option.id = `country-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(country.code === this.value.value));
      option.className = "country-option";
      option.dataset.countryIndex = String(index);
      const flag = document.createElement("span");
      flag.className = "country-flag";
      flag.setAttribute("aria-hidden", "true");
      flag.textContent = country.flag;
      const name = document.createElement("span");
      name.textContent = country.name;
      option.append(flag, name);
      this.menu.append(option);
    });
    if (!this.filtered.length) {
      const empty = document.createElement("p");
      empty.className = "country-empty";
      empty.textContent = "لا توجد دول مطابقة لبحثك.";
      this.menu.append(empty);
    }
    this.active = -1;
    this.input.removeAttribute("aria-activedescendant");
    this.positioner.open();
    this.announcement.textContent = this.filtered.length
      ? `${this.filtered.length} countries available` : "لا توجد نتائج.";
  }

  close() {
    this.positioner.close();
    this.active = -1;
  }

  choose(index) {
    const country = this.filtered[index];
    if (!country) return;
    this.input.value = country.label;
    this.value.value = country.code;
    this.input.setCustomValidity("");
    this.input.removeAttribute("aria-invalid");
    this.input.dispatchEvent(new Event("change", { bubbles: true }));
    this.close();
  }

  keydown(event) {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (this.menu.hidden) this.open(this.value.value ? "" : this.input.value);
      if (!this.filtered.length) return;
      this.active = (this.active + (event.key === "ArrowDown" ? 1 :
        this.active === -1 ? 0 : -1) + this.filtered.length) % this.filtered.length;
      [...this.menu.children].forEach((option, index) =>
        option.classList.toggle("is-active", index === this.active));
      const option = this.menu.children[this.active];
      this.input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && !this.menu.hidden) {
      event.preventDefault();
      if (this.active >= 0) this.choose(this.active);
      else if (this.value.value) this.close();
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      this.close();
    }
  }
}
