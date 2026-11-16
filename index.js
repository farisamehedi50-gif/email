export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET অথবা POST থেকে কুয়েরি বা ইমেইল রিসিভ করা
    let searched_email = '';
    
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        searched_email = (body.query || body.email || '').trim();
      } catch (e) {
        // যদি JSON না হয়, তবে URLSearchParams ট্রাই করা
        const formData = await request.formData();
        searched_email = (formData.get('query') || formData.get('email') || '').trim();
      }
    } else {
      searched_email = (url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('email') || '').trim();
    }

    // হেডার সেটআপ
    const jsonHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    };

    // ইমেইল বা কুয়েরি না থাকলে এরর রেসপন্স
    if (!searched_email) {
      return new Response(JSON.stringify({
        "success": false,
        "status": "error",
        "message": "অনুগ্রহ করে একটি সঠিক ইমেইল বা কুয়েরি প্রদান করুন।"
      }, null, 2), { status: 400, headers: jsonHeaders });
    }

    // সাধারণ ইমেইল ভ্যালিডেশন রেজেক্স
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(searched_email)) {
      return new Response(JSON.stringify({
        "success": false,
        "status": "error",
        "message": "অনুগ্রহ করে একটি সঠিক ইমেইল অ্যাড্রেস লিখুন।"
      }, null, 2), { status: 400, headers: jsonHeaders });
    }

    // Telefunc পেলোড প্রস্তুত করা
    const payload = {
      "file": "/app/rpc/search.telefunc.ts",
      "name": "public_search",
      "args": [
        {
          "piis": [
            {
              "type": "email",
              "value": searched_email,
              "pii_id": "1"
            }
          ],
          "main_breach_id": "!undefined"
        }
      ]
    };

    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      "Content-Type": "text/plain",
      "Origin": "https://databreach.com",
      "Referer": "https://databreach.com/"
    };

    try {
      // Fetch রিকোয়েস্ট পাঠানো
      const apiResponse = await fetch("https://databreach.com/_telefunc", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }

      const responseText = await apiResponse.text();
      let decoded;
      try {
        decoded = JSON.parse(responseText);
      } catch (err) {
        decoded = responseText;
      }

      const raw_data = decoded['return'] ?? decoded;
      const results_array = raw_data['ret']?.['results'] ?? raw_data['results'] ?? (Array.isArray(raw_data) ? raw_data : []);
      
      let formatted_breaches = [];
      if (Array.isArray(results_array)) {
        let serial = 1;
        for (const item of results_array) {
          if (item && typeof item === 'object') {
            const label = item['label'] ?? item['breach_id'] ?? 'অজ্ঞাত ডাটাবেজ';
            const attack_date = item['attack_date'] ?? 'তারিখ পাওয়া যায়নি';
            const upload_date = item['upload_date'] ?? 'N/A';
            
            // বিবরণ ছোট এবং পরিষ্কার করার লজিক
            let description = item['description_md'] ? item['description_md'].replace(/<[^>]*>?/gm, '').trim() : 'বিবরণ পাওয়া যায়নি।';
            if (description.length > 300) {
              description = description.substring(0, 300) + "...";
            }

            const found_items = item['found'] ?? [];
            let has_pass = false;
            let found_types = [];

            if (Array.isArray(found_items)) {
              for (const f of found_items) {
                if (f && f['type']) {
                  found_types.push(f['type']);
                  if (f['type'] === 'pass') {
                    has_pass = true;
                  }
                }
              }
            }

            formatted_breaches.push({
              "serial_no": serial++,
              "database_name": label,
              "attack_date": attack_date,
              "upload_date": upload_date,
              "has_password": has_pass ? "Yes ⚠️" : "No ✅",
              "exposed_types": found_types,
              "summary": description
            });
          }
        }
      }

      const total_found = formatted_breaches.length;
      const is_safe = (total_found === 0);

      const finalOutput = {
        "success": true,
        "status": is_safe ? "SAFE" : "BREACHED",
        "target_email": searched_email,
        "total_breaches": total_found,
        "security_status": is_safe ? "✅ কোনো ডাটা লিক পাওয়া যায়নি" : `⚠️ মোট ${total_found}টি ডাটাবেজে তথ্য লিক পাওয়া গেছে!`,
        "breaches_list": formatted_breaches,
        "developer_info": {
          "create": "TG: @XrootCodeX",
          "Devloper": "TG: @MehediSanix"
        }
      };

      return new Response(JSON.stringify(finalOutput, null, 2), {
        status: 200,
        headers: jsonHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        "success": false,
        "status": "error",
        "message": "নেটওয়ার্ক এরর: " + error.message
      }, null, 2), { status: 500, headers: jsonHeaders });
    }
  }
};
