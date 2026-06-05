export async function sendWhatsAppMessage(to: string, message: string) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.error("FONNTE_TOKEN is not defined in environment variables.");
    return { success: false, error: "Token WhatsApp tidak terkonfigurasi." };
  }

  // Bersihkan karakter non-digit, dan ubah awalan '0' menjadi '62'
  let target = to.replace(/\D/g, "");
  if (target.startsWith("0")) {
    target = "62" + target.slice(1);
  }

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: new URLSearchParams({
        target: target,
        message: message,
      }),
    });

    const resData = await response.json();
    
    // API Fonnte mengembalikan status: true/false
    if (resData.status === true) {
      return { success: true, data: resData };
    } else {
      console.error("Fonnte API error response:", resData);
      return { success: false, error: resData.reason || "Gagal mengirim pesan via Fonnte." };
    }
  } catch (error: any) {
    console.error("Fonnte connection error:", error);
    return { success: false, error: error.message || "Gagal menghubungi server Fonnte." };
  }
}
