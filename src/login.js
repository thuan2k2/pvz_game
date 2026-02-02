import { 
    loginUser, registerNewUser, loginWithGoogle, 
    verifyAndResetPassword, checkEmailForReset, completeUserProfile 
} from "./firebase/auth.js";

// DOM Elements
const loginBtn = document.getElementById('btn-login');
const googleBtn = document.getElementById('btn-google');
const registerBtn = document.getElementById('btn-register');
const resetBtn = document.getElementById('btn-reset-pass');
const completeBtn = document.getElementById('btn-complete-profile');

const loginError = document.getElementById('login-error');
const regError = document.getElementById('reg-error');
const forgotError = document.getElementById('forgot-error');
const forgotSuccess = document.getElementById('forgot-success');
const completeError = document.getElementById('complete-error');

// --- 1. XỬ LÝ QUÊN MẬT KHẨU THÔNG MINH ---
window.checkEmailStatus = async () => {
    const email = document.getElementById('forgot-email').value;
    const phoneInput = document.getElementById('forgot-phone');
    const msgEl = document.getElementById('phone-status-msg');
    
    if (!email) return;

    try {
        phoneInput.disabled = true;
        msgEl.innerText = "Đang kiểm tra...";
        msgEl.style.color = "blue";

        const check = await checkEmailForReset(email);

        if (!check.exists) {
            msgEl.innerText = "Email này chưa đăng ký!";
            msgEl.style.color = "red";
            phoneInput.disabled = true;
        } else if (check.requirePhone) {
            msgEl.innerText = "Vui lòng nhập SĐT để xác minh.";
            msgEl.style.color = "#555";
            phoneInput.disabled = false;
            phoneInput.value = "";
            phoneInput.placeholder = "Nhập SĐT...";
        } else {
            // Google User -> Không cần SĐT
            msgEl.innerText = "Tài khoản Google: Không cần SĐT.";
            msgEl.style.color = "green";
            phoneInput.disabled = true;
            phoneInput.value = "Không cần nhập SĐT";
        }
    } catch (error) {
        console.error(error);
        msgEl.innerText = "Lỗi kiểm tra.";
    }
};

resetBtn.addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value;
    const phone = document.getElementById('forgot-phone').value;
    
    forgotError.style.display = 'none';
    forgotSuccess.style.display = 'none';
    resetBtn.innerText = "Đang xử lý...";

    try {
        await verifyAndResetPassword(email, phone);
        forgotSuccess.innerText = "✅ Đã gửi email! Hãy kiểm tra hộp thư.";
        forgotSuccess.style.display = 'block';
    } catch (error) {
        forgotError.innerText = error.message;
        forgotError.style.display = 'block';
    } finally {
        resetBtn.innerText = "Lấy Lại Mật Khẩu";
    }
});

// --- 2. XỬ LÝ GOOGLE LOGIN & HOÀN THIỆN HỒ SƠ ---
googleBtn.addEventListener('click', async () => {
    try {
        const result = await loginWithGoogle();
        
        if (result.isNewOrIncomplete) {
            // Hiện Modal Hoàn thiện hồ sơ
            document.getElementById('modal-complete-profile').style.display = 'flex';
            // Lưu user tạm vào biến global để dùng ở bước sau
            window.tempGoogleUser = result.user;
        } else {
            window.location.href = "index.html";
        }
    } catch (error) {
        loginError.innerText = error.message;
        loginError.style.display = 'block';
    }
});

completeBtn.addEventListener('click', async () => {
    const pass = document.getElementById('comp-password').value;
    const phone = document.getElementById('comp-phone').value;
    
    if (pass.length < 6) return alert("Mật khẩu phải trên 6 ký tự");
    if (!phone) return alert("Vui lòng nhập SĐT");

    completeBtn.innerText = "Đang lưu...";
    completeError.style.display = 'none';

    try {
        if (window.tempGoogleUser) {
            await completeUserProfile(window.tempGoogleUser, pass, phone);
            alert("Cập nhật thành công! Vào game...");
            window.location.href = "index.html";
        }
    } catch (error) {
        completeError.innerText = error.message;
        completeError.style.display = 'block';
        completeBtn.innerText = "Lưu & Vào Game";
    }
});

// --- 3. CÁC LOGIC CŨ (LOGIN THƯỜNG / REGISTER) ---
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await loginUser(email, pass);
        window.location.href = "index.html";
    } catch (error) {
        loginError.innerText = "Sai email hoặc mật khẩu!";
        loginError.style.display = 'block';
    }
});

registerBtn.addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm-pass').value;

    if (pass !== confirm) {
        regError.innerText = "Mật khẩu không khớp!";
        regError.style.display = 'block';
        return;
    }

    try {
        await registerNewUser(email, pass, phone);
        alert("Đăng ký thành công! Đang đăng nhập...");
        window.location.href = "index.html";
    } catch (error) {
        regError.innerText = error.message;
        regError.style.display = 'block';
    }
});