#!/usr/bin/env python3
"""
生成网址获取扩展的专业图标
设计理念：
- 链环造型象征"链接/网址"
- 渐变配色体现现代感
- 简洁扁平化设计风格
"""

from PIL import Image, ImageDraw, ImageFilter

def create_rounded_gradient_background(size, colors):
    """创建圆角渐变背景"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制渐变背景
    for y in range(size):
        ratio = y / size
        r = int(colors[0][0] * (1 - ratio) + colors[1][0] * ratio)
        g = int(colors[0][1] * (1 - ratio) + colors[1][1] * ratio)
        b = int(colors[0][2] * (1 - ratio) + colors[1][2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    
    # 创建圆角遮罩
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = size // 6
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    
    # 应用圆角
    img.putalpha(mask)
    return img

def draw_chain_link(draw, x, y, w, h, thickness, color, tilt=0):
    """绘制一个链环"""
    # 外椭圆
    draw.ellipse([x, y, x + w, y + h], outline=color, width=thickness)
    # 内椭圆（镂空效果）- 确保不会越界
    inner_margin = min(thickness * 2, w // 4, h // 4)
    inner_x0 = x + inner_margin
    inner_y0 = y + inner_margin
    inner_x1 = x + w - inner_margin
    inner_y1 = y + h - inner_margin
    
    # 确保坐标有效
    if inner_x1 > inner_x0 and inner_y1 > inner_y0:
        draw.ellipse([inner_x0, inner_y0, inner_x1, inner_y1], 
                     fill=(0, 0, 0, 0))

def create_icon(size):
    """创建指定尺寸的图标"""
    # 渐变配色：优雅的深蓝紫渐变
    colors = [(41, 128, 185), (109, 213, 250)]  # 蓝到亮蓝
    
    # 创建背景
    img = create_rounded_gradient_background(size, colors)
    draw = ImageDraw.Draw(img)
    
    center_x = size // 2
    center_y = size // 2
    
    # 根据尺寸选择不同的设计风格
    if size <= 16:
        # 16px：极简风格，单链环
        padding = 3
        thickness = 2
        link_color = (255, 255, 255, 240)
        # 绘制一个清晰的链环
        draw.ellipse([padding, center_y - 4, size - padding, center_y + 4], 
                     outline=link_color, width=thickness)
    else:
        # 48px/128px：双链环设计
        padding = size // 4
        link_width = size // 2 + size // 8
        link_height = size // 3
        thickness = max(2, size // 14)
        
        # 链环颜色（半透明白色）
        link_color = (255, 255, 255, 230)
        
        # 绘制两个交叉的链环
        offset = size // 10
        
        # 第一个链环
        draw_chain_link(draw, 
                        center_x - link_width // 2 - offset + 1,
                        center_y - link_height // 2,
                        link_width, link_height, thickness, link_color)
        
        # 第二个链环（穿插效果）
        draw_chain_link(draw,
                        center_x - link_width // 2 + offset - 1,
                        center_y - link_height // 2,
                        link_width, link_height, thickness, link_color)
        
        # 添加高光效果（小圆点）
        highlight_color = (255, 255, 255, 120)
        highlight_size = max(2, size // 14)
        draw.ellipse([padding - 2, padding - 2, 
                      padding - 2 + highlight_size, padding - 2 + highlight_size],
                     fill=highlight_color)
    
    return img

def main():
    # 生成三种尺寸的图标
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        icon.save(f'icons/icon{size}.png', 'PNG')
        print(f'已生成 icons/icon{size}.png ({size}x{size})')
    
    print('图标生成完成！')

if __name__ == '__main__':
    main()