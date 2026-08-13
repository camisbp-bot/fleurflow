const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Chaves do seu Supabase
const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseViews(text) {
    if (!text) return 0;
    // Tenta achar números que tenham K, M ou B colados neles
    let match = String(text).toUpperCase().match(/[\d\.,]+[KMB]?/);
    if (!match) return 0;

    let numStr = match[0];
    let multiplicador = 1;
    
    if (numStr.includes('K')) multiplicador = 1000;
    if (numStr.includes('M')) multiplicador = 1000000;
    if (numStr.includes('B')) multiplicador = 1000000000;

    numStr = numStr.replace(/[KMB]/g, '');
    if (numStr.includes(',') && !numStr.includes('.')) {
        numStr = numStr.replace(',', '.');
    } else {
        numStr = numStr.replace(/,/g, '');
    }

    let numero = parseFloat(numStr);
    return isNaN(numero) ? 0 : Math.round(numero * multiplicador);
}

async function run() {
    console.log("🤖 Robô Ninja ativado: Caçando o Ícone de Olho 👁️...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco de dados:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        
        try {
            console.log(`\n🔎 Lendo site: ${obra.nome}`);
            
            // Acesso liberado comprovado
            const res = await fetch(obra.link_scan, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.google.com/',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Chromium";v="122", "Google Chrome";v="122"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                } 
            });
            
            const html = await res.text();
            const $ = cheerio.load(html);
            let textViews = '';

            // 🎯 ESTRATÉGIA 1: O Caçador de Ícone de Olho (Procura a classe "eye" e pega o texto do lado)
            $('i[class*="eye"]').each((i, el) => {
                let parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
                // Se o texto do lado do olho tiver números + K/M/B (Ex: 1.7M)
                if(parentText.match(/[\d\.,]+[KMB]?/)) {
                    textViews = parentText;
                    return false; // Interrompe a busca pois já achou
                }
            });

            // 🎯 ESTRATÉGIA 2: Busca perto de "Comentários" (como na sua imagem)
            if (!textViews) {
                $('div, span, li').each((i, el) => {
                    let texto = $(el).text();
                    if(texto.includes('Comentários') && texto.match(/[\d\.,]+[KMB]?/)) {
                        textViews = texto;
                        return false;
                    }
                });
            }

            // 🎯 ESTRATÉGIA 3: Classes padrões de temas de Webtoons
            if (!textViews) {
                textViews = $('.post-total-views').first().text() ||
                            $('.manga-info-views').first().text() ||
                            $('.view-count').first().text();
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                console.log(`👁️ Texto capturado do site: "${textViews}" -> Convertido com precisão para: ${novasViews}`);
                
                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ SUCESSO! Banco do Supabase atualizado.`);
            } else {
                console.log(`⚠️ FALHA: A página abriu, mas não encontrou o ícone de olho nem os comentários.`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Erro de conexão em ${obra.nome}:`, e.message);
        }
    }
    console.log("\n🏁 Sincronização finalizada.");
}

run();
