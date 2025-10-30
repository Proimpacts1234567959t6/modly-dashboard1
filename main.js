// Fetch text channels for dropdowns
async function loadChannels(guildId) {
  const res = await fetch(`/api/channels/${guildId}`);
  const channels = await res.json();
  document.querySelectorAll("select").forEach(select => {
    select.innerHTML = "";
    channels.forEach(ch => {
      const opt = document.createElement("option");
      opt.value = ch.id;
      opt.textContent = "#" + ch.name;
      select.appendChild(opt);
    });
  });
}

if (window.location.pathname.includes("/dashboard/")) {
  const parts = window.location.pathname.split("/");
  const guildId = parts[2];
  loadChannels(guildId);
}

// ================= Embed Builder =================
let embeds = [];

function addEmbed() {
  const container = document.getElementById("embedsContainer");
  const index = embeds.length;
  embeds.push({ title: "", description: "", color: "#5865F2" });

  const box = document.createElement("div");
  box.className = "embed-box";
  box.innerHTML = `
    <label>Title</label>
    <input type="text" onchange="updateEmbed(${index}, 'title', this.value)" />
    <label>Description</label>
    <textarea onchange="updateEmbed(${index}, 'description', this.value)"></textarea>
    <label>Color</label>
    <input type="color" onchange="updateEmbed(${index}, 'color', this.value)" />
    <button class="remove-btn" onclick="removeEmbed(${index}, this)">Remove</button>
  `;
  container.appendChild(box);
}

function updateEmbed(i, key, value) {
  embeds[i][key] = value;
}

function removeEmbed(i, el) {
  embeds.splice(i, 1);
  el.parentElement.remove();
}

async function sendEmbeds() {
  const guildId = window.location.pathname.split("/")[2];
  const channelId = document.getElementById("builderChannel").value;
  if (!channelId) return alert("Select a channel first.");

  const payload = {
    channelId,
    embeds: embeds.map(e => ({
      title: e.title,
      description: e.description,
      color: parseInt(e.color.replace("#", ""), 16),
    })),
  };

  const res = await fetch("/api/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) alert("Message sent successfully!");
  else alert("Failed to send message.");
}



