const login_switch_button = document.getElementById("login-switch")
const user_input = document.getElementById("userinput")
let current = user_input.innerHTML

login_switch_button.addEventListener("click", function(event) {
    console.log("Testing")
    event.preventDefault();
    if (current === "Username") {
        current = "Email"
        user_input.innerHTML = "Email"
    } else {
        current = "Username"
        user_input.innerHTML = "Username"
    }
})
