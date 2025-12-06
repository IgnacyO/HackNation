function loadStory(storyId) {
    // Remove existing points
    document.querySelectorAll(".point").forEach(el => el.remove());

    fetch(`/story/${storyId}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("map-container");

            data.points.forEach(p => {
                const dot = document.createElement("div");
                dot.className = "point";
                dot.style.left = p[0] + "px";
                dot.style.top = p[1] + "px";
                container.appendChild(dot);
            });
        });
}
