#!/usr/bin/env python3
"""
Gera ícones PWA (PNG) a partir do logo SVG ZatendeStok
"""

from PIL import Image, ImageDraw, ImageFont
import io

def create_icon(size):
    """Cria um ícone PNG do logo ZatendeStok"""
    # Background gradient (preto escuro)
    img = Image.new('RGB', (size, size), color='#0d0b07')
    draw = ImageDraw.Draw(img)
    
    # Desenha retângulo arredondado (background)
    radius = int(size * 0.23)  # 11/48 = 0.23
    draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius=radius, fill='#0d0b07')
    
    # Desenha borda sutil
    draw.rounded_rectangle([(1, 1), (size-2, size-2)], radius=radius-1, outline='#ffffff12', width=2)
    
    # Desenha o "Z" raio laranja (simplificado)
    # Path original: M9 11h24l-2.5 4H14L28 28h-5.5L9 14.5V11z M39 34H15l2.5-4H31L17 17h5.5L39 30.5V34z
    # Vamos fazer formas simples em laranja
    
    scale = size / 48.0
    
    def s(coord):
        """Escala coordenada"""
        if isinstance(coord, (list, tuple)):
            return [(int(x * scale), int(y * scale)) for x, y in coord]
        return int(coord * scale)
    
    # Z superior (laranja → amarelo gradient - simplificado como laranja sólido)
    z1_points = [
        (s(9), s(11)),   # top-left
        (s(33), s(11)),  # top-right
        (s(30.5), s(15)), # kink
        (s(14), s(15)),  # left kink
        (s(28), s(28)),  # bottom-right
        (s(22.5), s(28)), # bottom-left kink
        (s(9), s(14.5)), # back to left
    ]
    draw.polygon(z1_points, fill='#fb923c')
    
    # Z inferior (invertido)
    z2_points = [
        (s(39), s(34)),  # bottom-right
        (s(15), s(34)),  # bottom-left
        (s(17.5), s(30)), # kink
        (s(31), s(30)),  # right kink
        (s(17), s(17)),  # top-left
        (s(22.5), s(17)), # top-right kink
        (s(39), s(30.5)), # back to right
    ]
    draw.polygon(z2_points, fill='#f97316')
    
    # Linha diagonal conectora (sutil)
    draw.line([(s(14), s(15)), (s(32), s(29))], fill='#fbbf2440', width=s(1.5))
    
    return img

# Gera os ícones em vários tamanhos
sizes = [32, 48, 192, 256, 512]

for size in sizes:
    print(f"Gerando icon-{size}.png...")
    icon = create_icon(size)
    icon.save(f"public/icon-{size}.png", 'PNG', optimize=True)

print("✅ Ícones PWA gerados com sucesso!")
print("   - icon-32.png")
print("   - icon-48.png")
print("   - icon-192.png")
print("   - icon-256.png")
print("   - icon-512.png")
