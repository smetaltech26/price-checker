/**
 * Google Apps Script สำหรับดึงข้อมูลราคาจาก Google Sheets (Sheet: price)
 * 
 * วิธีการติดตั้ง:
 * 1. เปิดไฟล์ Google Sheets ของพี่ต้น
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) -> "Apps Script"
 * 3. ลบโค้ดเดิมใน Apps Script ออกให้หมด
 * 4. คัดลอก (Copy) โค้ดด้านล่างนี้ทั้งหมดไปวางแทนที่
 * 5. กดปุ่มบันทึก (รูปแผ่นดิสก์)
 * 6. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) ที่มุมขวาบน -> "การทำให้ใช้งานได้ใหม่" (New deployment)
 * 7. เลือกประเภทการใช้งานเป็น "เว็บแอป" (Web app) (คลิกไอคอนฟันเฟืองข้างๆ "เลือกประเภท")
 * 8. ตั้งค่าดังนี้:
 *    - คำอธิบาย: ดึงราคาสินค้า
 *    - เรียกใช้เป็น: "ฉัน" (Execute as: Me / อีเมลของพี่ต้น)
 *    - ผู้มีสิทธิ์เข้าถึง: "ทุกคน" (Who has access: Anyone) **สำคัญมากค่ะ!**
 * 9. กดปุ่ม "ทำให้ใช้งานได้" (Deploy)
 * 10. ระบบจะขอสิทธิ์การเข้าถึง ให้กด "ให้สิทธิ์เข้าถึง" (Authorize Access) และกดอนุญาตให้เรียบร้อย
 * 11. คัดลอก "URL ของเว็บแอป" (Web App URL) ที่ได้มา เพื่อนำไปใส่ในเว็บแอปเช็คราคาค่ะ
 */

function doGet(e) {
  try {
    // 1. เปิด Spreadsheet (รองรับทั้งแบบผูกกับชีต และแบบแยกสคริปต์เดี่ยว)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      // กรอก Google Sheet ID ของพี่ต้นตรงนี้ได้เลยค่ะ (ระวังตัว I (ไอใหญ่) กับ l (แอลเล็ก) นะคะ ก๊อปปี้จาก URL ชัวร์สุดค่ะ)
      ss = SpreadsheetApp.openById("1Aq1ZvwqKVKDQGIynEILrFIEe6A-sUqFk9Ztxm6SrNPo");
    }
    var sheet = ss.getSheetByName("price");
    
    if (!sheet) {
      return createJsonResponse({
        status: "error",
        message: "ไม่พบ Sheet ที่ชื่อ 'price' กรุณาตรวจสอบการตั้งชื่อ Sheet ใน Google Sheets นะคะ"
      });
    }
    
    // 2. ดึงข้อมูลทั้งหมดใน Sheet
    var range = sheet.getDataRange();
    var values = range.getValues();
    
    if (values.length <= 1) {
      return createJsonResponse({
        status: "error",
        message: "ไม่มีข้อมูลใน Sheet หรือมีแค่แถวหัวตารางอย่างเดียวค่ะ"
      });
    }
    
    // 3. แปลงแถวแรกเป็นหัวตาราง (Headers)
    var headers = values[0].map(function(h) {
      return String(h).trim().toUpperCase();
    });
    
    // ค้นหาดัชนีของคอลัมน์ที่ต้องการ
    var idxItem = headers.indexOf("ITEM");
    var idxName = headers.indexOf("NAME PART");
    var idxModel = headers.indexOf("MODEL");
    var idxDrawing = headers.indexOf("DRAWING");
    var idxPrice = headers.indexOf("PRICE");
    var idxRmPrice = headers.indexOf("RM PRICE");
    
    // ตรวจสอบว่ามีคอลัมน์สำคัญครบไหม
    if (idxItem === -1) {
      return createJsonResponse({
        status: "error",
        message: "ไม่พบคอลัมน์ชื่อ 'ITEM' ในแถวแรกของชีตค่ะ"
      });
    }
    
    var itemsList = [];
    
    // 4. วนลูปอ่านข้อมูลสินค้าแต่ละแถว (เริ่มที่แถวที่ 2 หรือ i = 1)
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var itemCode = String(row[idxItem]).trim();
      
      // ข้ามแถวที่คอลัมน์ ITEM ว่างเปล่า
      if (!itemCode) continue;
      
      var namePart = idxName !== -1 ? String(row[idxName]).trim() : "";
      var model = idxModel !== -1 ? String(row[idxModel]).trim() : "";
      var drawing = idxDrawing !== -1 ? String(row[idxDrawing]).trim() : "";
      
      // จัดการกับราคาขาย
      var priceVal = idxPrice !== -1 ? row[idxPrice] : "";
      var price = formatPrice(priceVal);
      
      // จัดการกับราคาวัตถุดิบ
      var rmPriceVal = idxRmPrice !== -1 ? row[idxRmPrice] : "";
      var rmPrice = formatPrice(rmPriceVal);
      
      itemsList.push({
        item: itemCode,
        name: namePart,
        model: model,
        drawing: drawing,
        price: price,
        rm_price: rmPrice
      });
    }
    
    // 5. ส่งข้อมูลออกไปเป็น JSON
    return createJsonResponse({
      status: "success",
      last_updated: new Date().toISOString(),
      data: itemsList
    });
    
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "เกิดข้อผิดพลาด: " + error.toString()
    });
  }
}

// ฟังก์ชันช่วยจัดรูปแบบราคา
function formatPrice(val) {
  if (val === null || val === undefined || val === "" || val === "-") {
    return null;
  }
  var num = Number(val);
  return isNaN(num) ? String(val).trim() : num;
}

// ฟังก์ชันส่งออก JSON พร้อมจัดการ CORS
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
