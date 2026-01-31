const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Cấu hình thưởng trên Server
const REWARD_CONFIG = {
    min: 100,
    max: 500
};

// [CẬP NHẬT] Thêm plant_food vào danh sách giá
const ITEMS_PRICE = {
    "sun_pack": 200,
    "golden_shovel": 10000,
    "plant_food": 500 
};

/**
 * HÀM 1: XỬ LÝ KẾT THÚC GAME
 */
exports.claimEndGameReward = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Bạn phải đăng nhập.');
    }

    const uid = request.auth.uid;
    const { isVictory } = request.data;

    if (!isVictory) {
        return { success: true, reward: 0, message: "Thua không có quà!" };
    }

    const reward = Math.floor(Math.random() * (REWARD_CONFIG.max - REWARD_CONFIG.min + 1)) + REWARD_CONFIG.min;
    const userRef = db.collection('users').doc(uid);
    
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            if (!doc.exists) throw new HttpsError('not-found', 'User không tồn tại');
            
            const newBalance = (doc.data().coins || 0) + reward;
            t.update(userRef, { coins: newBalance });
        });

        return { success: true, reward: reward, message: "Nhận thưởng thành công" };
    } catch (error) {
        console.error("Lỗi transaction:", error);
        throw new HttpsError('internal', 'Lỗi cộng tiền');
    }
});

/**
 * HÀM 2: MUA VẬT PHẨM (Đã cập nhật logic kiểm tra tồn kho)
 */
exports.buyShopItem = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Chưa đăng nhập.');

    const uid = request.auth.uid;
    const { itemId } = request.data;
    
    // Kiểm tra vật phẩm có tồn tại trong danh sách giá không
    const price = ITEMS_PRICE[itemId];
    if (!price) throw new HttpsError('invalid-argument', 'Vật phẩm không tồn tại.');

    const userRef = db.collection('users').doc(uid);

    try {
        const newBalance = await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            if (!doc.exists) throw new HttpsError('not-found', 'User không tìm thấy');

            const userData = doc.data();
            const currentCoins = userData.coins || 0;
            const inventory = userData.inventory || [];

            // 1. Logic riêng cho vật phẩm mua 1 lần (như sun_pack)
            // Nếu đã có trong kho rồi thì không cho mua nữa
            if (itemId === 'sun_pack' && inventory.includes(itemId)) {
                throw new HttpsError('already-exists', 'Bạn đã sở hữu vật phẩm này rồi!');
            }
            // Lưu ý: plant_food là vật phẩm tiêu hao nên không check inventory, cho phép mua nhiều lần.

            // 2. Kiểm tra tiền
            if (currentCoins < price) {
                throw new HttpsError('failed-precondition', 'Không đủ tiền!');
            }

            // 3. Trừ tiền
            const balanceAfter = currentCoins - price;
            
            // 4. Chuẩn bị dữ liệu cập nhật
            const updates = { coins: balanceAfter };

            // Nếu không phải là plant_food (tiêu hao), thì lưu vào kho của Server
            // (plant_food đang được quản lý số lượng ở Client localStorage để đơn giản hóa)
            if (itemId !== 'plant_food') {
                updates.inventory = admin.firestore.FieldValue.arrayUnion(itemId);
            }

            t.update(userRef, updates);
            
            return balanceAfter;
        });

        return { success: true, newBalance: newBalance };
    } catch (error) {
        // Ném lỗi về client
        throw error;
    }
});