(() => {
  const section = document.createElement("section");
  section.id = "accreditation";
  section.className = "ma-accreditation";
  section.dir = "rtl";
  section.setAttribute("aria-labelledby", "ma-accreditation-title");
  const inner = document.createElement("div");
  inner.className = "ma-accreditation__inner";
  const heading = document.createElement("h2");
  heading.id = "ma-accreditation-title";
  heading.textContent = "اكاديميه معتمده و موثقه محليا ودوليا";
  const cards = document.createElement("div");
  cards.className = "ma-accreditation__logos";
  // Display only the accreditation images supplied by the academy.
  const accreditations = [
    { image: "nelc", name: "المركز الوطني للتعليم الإلكتروني" },
    { image: "tvtc", name: "المؤسسة العامة للتدريب التقني والمهني" },
    { image: "cpd", name: "المعهد المهني للتطوير CPD" },
    { image: "iso", name: "شهادة الأيزو ISO" },
  ];
  for (const item of accreditations) {
    const card = document.createElement("figure");
    card.className = "ma-accreditation__card";
    const image = document.createElement("img");
    image.src = `/assets/images/accreditation-${item.image}.png`;
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 300;
    image.height = 100;
    const caption = document.createElement("figcaption");
    caption.textContent = item.name;
    card.append(image, caption);
    cards.append(card);
  }
  inner.append(heading, cards);
  section.append(inner);
  let scheduled = false;
  function mount() {
    scheduled = false;
    const companyLogos = document.querySelector(".framer-1qa0kh4");
    if (companyLogos && companyLogos.previousElementSibling !== section) companyLogos.before(section);
  }
  mount();
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(mount);
  }).observe(document.body, { childList: true, subtree: true });
})();
