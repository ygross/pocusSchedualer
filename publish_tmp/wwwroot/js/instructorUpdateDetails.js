const apiBase = "/api/instructor";

document.addEventListener("DOMContentLoaded", () => {
    loadInstructorDetails();
    document
        .getElementById("instructorUpdateDetailsForm")
        .addEventListener("submit", saveInstructorDetails);
});

async function loadInstructorDetails() {
    try {
        const res = await fetch(`${apiBase}/me`);
        if (!res.ok) throw "טעינת פרטים נכשלה";

        const d = await res.json();

        document.getElementById("loggedFullName").innerText = d.fullName;
        document.getElementById("email").value = d.email;
        document.getElementById("fullName").value = d.fullName;
        document.getElementById("phone").value = d.phone ?? "";
        document.getElementById("department").value = d.department ?? "";
        document.getElementById("role").value = d.role;

    } catch (e) {
        showMsg(e, true);
    }
}

async function saveInstructorDetails(e) {
    e.preventDefault();

    const payload = {
        fullName: fullName.value.trim(),
        phone: phone.value.trim(),
        department: department.value.trim()
    };

    try {
        const res = await fetch(`${apiBase}/me`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw "שמירת פרטים נכשלה";

        showMsg("✔ הפרטים עודכנו בהצלחה");

    } catch (e) {
        showMsg(e, true);
    }
}

function showMsg(text, isError = false) {
    const el = document.getElementById("formMessage");
    el.innerText = text;
    el.className = "form-message " + (isError ? "error" : "success");
}
