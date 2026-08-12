const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Chaves do seu Supabase (as mesmas do painel)
const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Converte letras em números reais (ex: 1.5K vira 1500)
function parseViews(text) {
    if(!text) return 0;
    let limpo = text.toUpperCase().replace(/[^0-9KMB\.,]/g, '').replace(',', '.');
    if(!limpo) return 0;
    let multiplicador = 1;
    if(limpo.includes('K')) multiplicador = 1000;
    if(limpo.includes('M')) multiplicador = 1000000;
    if(limpo.includes('B')) multiplicador = 1000000000;
    let numero = parseFloat(limpo.replace(/[KMB]/g, ''));
    return Math.round(numero * multiplicador);
}

async function run() {
    console.log("🤖 Acordando o Robô Sincronizador de Views...");
    
    // Puxa as obras do Supabase que têm link cadastrado
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        console.log(`🔎 Lendo site da obra: ${obra.nome}...`);
        
        try {
            // Acessa o site da scan se passando por um navegador normal
            const res = await fetch(obra.link_scan, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            const html = await res.text();
            const $ = cheerio.load(html);
            
            // Busca nas classes comuns de temas de scan
            let textViews = $('.post-total-views, .manga-info-views, .summary-content, i.ion-ios-eye + span, .view-count').text();
            
            // Se as classes falharem, usa "Força Bruta" pra achar a palavra "views" no código
            if(!textViews || textViews.trim() === '') {
                const match = html.match(/(\d+[.,]?\d*[KMBkmb]?)\s*(views|Views|visualizações)/i);
                if(match) textViews = match[1];
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                let viewsOntemSalvar = obra.views_ontem || 0;
                // Mágica diária: Se mudou o dia, as views de ontem viram as views totais que ele gravou antes!
                if(obra.data_verificacao !== hojeStr) viewsOntemSalvar = obra.views_totais || 0;
                
                await supabase.from('obras').update({ views_totais: novasViews, views_ontem: viewsOntemSalvar, data_verificacao: hojeStr }).eq('id', obra.id);
                console.log(`✅ Sucesso! ${obra.nome} bateu ${novasViews} views.`);
            } else {
                console.log(`⚠️ Não consegui ler as views da obra ${obra.nome}.`);
            }
            
            // Espera 2 segundinhos entre cada obra pra não derrubar o site da FleurFlow
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Falha ao acessar ${obra.nome}:`, e.message);
        }
    }
    console.log("🏁 Robô voltando a dormir. Até daqui a 1 hora!");
}

run();
