(function () {
  let details = window.START_PAGE || null;

  let history = [details];
  let historyIndex = 0;

  if (details) {
    setDetails(details);
  } else {
    getLinks("https://start.qot.nz");
  }

  function setDetails(data) {
    const image = document.querySelector(".output img");
    image.src = `data:image/png;base64,${data.image}`;

    const code = document.querySelector(".output code");
    code.textContent = data.url;
  }

  function getLinks(url) {
    const code = document.querySelector(".output code");
    code.textContent = `Loading... ${url}`;
    document.querySelector("html").classList.add("is-loading");
    document.querySelector("html").classList.remove("is-error");
    fetch("https://declutter.1j.nz/headless/link-codes/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw response.statusText;
      })
      .then((data) => {
        details = data;
        console.log(data);
        setDetails(details);
        historyIndex = history.push(details) - 1;
        document.querySelector("html").classList.remove("is-loading");
        const input = document.querySelector('input[name="code"]');
        input.value = '';
      })
      .catch((status) => {
        console.log("status", status);
        document.querySelector(".error").innerText = (status || "")
          .toString()
          .replace(/Gateway/i, "")
          .trim();
        document.querySelector("html").classList.add("is-error");
        document.querySelector("html").classList.remove("is-loading");
      });
  }

  document.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    document.querySelector("html").classList.add("is-loading");
    const code = e.target.code.value;
    const url = details.links[code];
    if (!url) {
      document.querySelector(".error").innerText = 'Invalid code; please try again.';
      document.querySelector("html").classList.add("is-error");
      document.querySelector("html").classList.remove("is-loading");
      return;
    }
    getLinks(url);
  });

  Array.from(document.querySelectorAll(".key-pad button"), (button) => {
    button.addEventListener("click", (event) => {
      const input = document.querySelector('input[name="code"]');
      const key = event.target.value;
      input.value += key;
    });
  });

  document
    .querySelector('[name="delete"]')
    .addEventListener("click", (event) => {
      document.querySelector("html").classList.remove("is-error");
      document.querySelector("html").classList.remove("is-loading");
      const input = document.querySelector('input[name="code"]');
      const letters = input.value.split("");
      letters.pop();
      input.value = letters.join("");
    });

    document
    .querySelector('[name="clear"]')
    .addEventListener("click", (event) => {
      document.querySelector("html").classList.remove("is-error");
      document.querySelector("html").classList.remove("is-loading");
      const input = document.querySelector('input[name="code"]');
      input.value = '';
    });

    document.querySelector('[name="back"]').addEventListener("click", (event) => {
      document.querySelector("html").classList.remove("is-error");
      document.querySelector("html").classList.remove("is-loading");
      const input = document.querySelector('input[name="code"]');
      input.value = "";
      historyIndex--;
      if (historyIndex < 0) {
        historyIndex = 0;
      }
      details = history[historyIndex];
      setDetails(details);
    });

    document.querySelector('[name="forward"]').addEventListener("click", (event) => {
      document.querySelector("html").classList.remove("is-error");
      document.querySelector("html").classList.remove("is-loading");
      const input = document.querySelector('input[name="code"]');
      input.value = "";
      historyIndex++;
      if (historyIndex >= history.length) {
        historyIndex = history.length - 1;
      }
      details = history[historyIndex];
      setDetails(details);
    });
})();
