const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseViews(text) {
    if (!text) return 0;
    let limpo = String(text).toUpperCase().trim();

    // Se o texto for um número exato longo (ex: 1224561, 1,224,561 ou 1.224.561)
    if (!limpo.match(/[KMB]/)) {
        let numExato = parseInt(limpo.replace(/[^\d]/g, ''));
        if (!isNaN(numExato)) return numExato;
    }

    let match = limpo.match(/[\d\.,]+[KMB]?/);
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
    console.log("🤖 Robô Ninja ativado: Modo Raio-X e Furador de Cache...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco de dados:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        
        try {
            console.log(`\n🔎 Analisando: ${obra.nome}`);
            
            // Adiciona um quebrador de cache para forçar o site a dar o número em tempo real
            const urlRealTime = obra.link_scan + (obra.link_scan.includes('?') ? '&' : '?') + 'nocache=' + Date.now();

            const res = await fetch(urlRealTime, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Upgrade-Insecure-Requests': '1'
                } 
            });
            
            const html = await res.text();
            
            if(html.includes('Cloudflare') || html.includes('Just a moment...')) {
                console.log(`❌ BLOQUEIO: Cloudflare barrou a quebra de cache.`);
                continue; 
            }

            const $ = cheerio.load(html);
            let textViews = '';
            let estrategiaUsada = '';

            // 🎯 ESTRATÉGIA 1: RAIO-X (Busca o número exato nas tags ocultas do WordPress/Google)
            let metaViews = $('meta[itemprop="interactionCount"]').attr('content') || 
                            $('meta[property="og:views"]').attr('content') ||
                            $('input[name*="views"]').val();
            
            if (metaViews && !isNaN(parseInt(metaViews))) {
                textViews = metaViews;
                estrategiaUsada = 'Visão Raio-X (Dados Ocultos)';
            }

            // 🎯 ESTRATÉGIA 2: O Caçador de Ícone de Olho (Se não achou dados ocultos)
            if (!textViews) {
                $('i[class*="eye"]').each((i, el) => {
                    let parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
                    if(parentText.match(/[\d\.,]+[KMB]?/)) {
                        textViews = parentText;
                        estrategiaUsada = 'Ícone de Olho';
                        return false;
                    }
                });
            }

            // 🎯 ESTRATÉGIA 3: Classes padrões de temas de Webtoons
            if (!textViews) {
                textViews = $('.post-total-views').first().text() ||
                            $('.manga-info-views').first().text() ||
                            $('.view-count').first().text();
                estrategiaUsada = 'Classes Padrões do Tema';
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                console.log(`🎯 Estratégia usada: ${estrategiaUsada}`);
                console.log(`👁️ Texto capturado: "${textViews}" -> Convertido para: ${novasViews}`);
                
                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ SUCESSO! Banco atualizado.`);
            } else {
                console.log(`⚠️ FALHA: A página abriu, mas nenhuma das estratégias encontrou as views.`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Erro de conexão em ${obra.nome}:`, e.message);
        }
    }
    console.log("\n🏁 Sincronização finalizada.");
}

run();
