# Jenerik Sonrası

İzlediğim dizi ve filmlere, hatta tek tek bölümlere puan verip yorum yazdığım kişisel not defteri.
Sade HTML/CSS/JS, derleme adımı yok; GitHub Pages'te olduğu gibi çalışır.

- Her dizi/film için: puan (0.5 adımlı, 10 üzerinden), yorum, **merak ettiklerim** (sonradan cevap eklenebilir), etiket, izleme tarihi, spoiler işareti
- Dizilerde sezon sekmeleri ve bölüm bazlı yorum
- Ad, yorum ve etikette arama; tür, durum ve puana göre filtre/sıralama
- Açık/koyu tema, telefonda rahat kullanım
- Ziyaretçiler yalnızca okur. Yazma, bu tarayıcıda token girince açılır.

## Nasıl çalışır?

GitHub Pages statik olduğu için sunucu yok. Tüm veri [`data/library.json`](data/library.json) dosyasında durur.
Sitede "Kaydet"e bastığında tarayıcı, GitHub API ile bu dosyaya doğrudan bir commit atar; Pages birkaç dakika içinde siteyi yeniler.
Dizi/film bilgileri ve afişler [TMDB](https://www.themoviedb.org/)'den gelir; ziyaretçiler TMDB'ye hiç istek atmaz, sadece afiş görsellerini yükler.

## Yayına alma (bir kez)

1. GitHub'da **public** bir repo aç (ücretsiz Pages için gerekli), bu klasörü içine it.
2. Repo → **Settings → Pages → Build and deployment**: Source `Deploy from a branch`, Branch `main`, klasör `/ (root)`.
3. Site `https://KULLANICI.github.io/REPO/` adresinde açılır.

## Yazma modunu açma (bir kez, her cihaz için)

1. **TMDB anahtarı:** themoviedb.org'da ücretsiz hesap aç → Ayarlar → API → API anahtarı al.
2. **GitHub token:** <https://github.com/settings/personal-access-tokens/new> adresinde *fine-grained* token oluştur.
   - *Repository access:* yalnızca bu repo
   - *Permissions → Repository permissions → Contents:* **Read and write**
3. Sitede sağ üstteki dişli simgesine tıkla, kullanıcı adı/repo (github.io adresinden otomatik dolar), token ve TMDB anahtarını gir → **Bağlantıyı dene** → **Kaydet**.

Bu bilgiler yalnızca o tarayıcının `localStorage`'ında durur, repoya yazılmaz. Başka bir cihazdan yazmak için orada da bir kez girmen gerekir.
Token'ı yalnızca tek repoya ve yalnızca Contents iznine sınırla; sızsa bile etkisi o repoyla sınırlı kalır.

## Yerelde deneme

ES modülleri kullanıldığı için `index.html`'i çift tıklayıp açma, bir statik sunucu kullan:

```bash
npx http-server -p 5173
```

Token olmadan denemek için Ayarlar'da "Deneme modu"nu aç; yorumlar yalnızca o tarayıcıda kalır ve oradan JSON olarak indirilebilir.

## Dosyalar

| Yol | Görevi |
| --- | --- |
| `index.html`, `css/style.css` | Sayfa ve görünüm |
| `js/app.js` | Yönlendirme, ana sayfa, dizi/film sayfaları |
| `js/editor.js` | Yorum yazma penceresi |
| `js/search.js` | TMDB'de arayıp kütüphaneye ekleme |
| `js/settings-ui.js`, `js/settings.js` | Ayarlar penceresi ve saklama |
| `js/store.js`, `js/github.js` | Veriyi okuma/yazma (GitHub API) |
| `js/tmdb.js` | TMDB istekleri |
| `data/library.json` | Tüm yorumlar (git geçmişi sürüm geçmişin olur) |

## Güvenlik

Sitede sunucu ve üçüncü taraf script yok; tek riskli şey, yazma modu için tarayıcıda duran GitHub token'ı. Önlemler:

- **Token'ı daralt:** fine-grained token, yalnızca bu repo, yalnızca *Contents: Read and write*. **Son kullanma tarihi koy** (ör. 90 gün); dolunca yenilersin.
- **Kayıp cihaz:** telefon/bilgisayar kaybolursa ya da ortak bir cihazda giriş yaptıysan önce Ayarlar → **Çıkış yap**, sonra <https://github.com/settings/personal-access-tokens> adresinden token'ı **Revoke** et.
- **GitHub hesabına 2FA aç** ve Pages'te *Enforce HTTPS* kutusunun işaretli olduğundan emin ol (varsayılan açıktır).
- **CSP:** `index.html` yalnızca sitenin kendi dosyalarına, `api.github.com`, `api.themoviedb.org` ve `image.tmdb.org` adreslerine izin verir. Bir XSS açığı çıksa bile token başka bir yere gönderilemez. **Yeni bir dış servis eklersen** bu satırı da güncellemen gerekir.
- **Kod tarafı:** kullanıcı metni hiçbir yerde `innerHTML` ile eklenmez; bağımlılık yok, dolayısıyla tedarik zinciri riski de yok.
- **Gizlilik:** afişler TMDB'den yüklendiği için ziyaretçilerin IP adresi TMDB'ye görünür (site adresi `no-referrer` ile gizlenir). TMDB anahtarı yalnızca sende, ziyaretçilerde yok.

## Notlar

- Repo public olduğu için **sildiğin yorumlar git geçmişinde kalır.** Hassas bir şey yanlışlıkla yazılırsa yalnızca silmek yetmez; geçmişi de temizlemek gerekir (ya da repoyu silip yeniden açmak).

- Yorumlar public repoda durduğu için herkesin okuyabileceği şeyler yaz. Spoiler işareti yalnızca sayfada gizler, `library.json` dosyasında açık metin görünür.
- `library.json` 1 MB'ı geçerse bile okunur, ama o noktada veriyi dizi başına dosyalara bölmek mantıklı olur.
- Bu ürün TMDB API'sini kullanır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır.
