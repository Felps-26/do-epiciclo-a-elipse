#!/usr/bin/env python3
"""
CLI para simulação de órbitas planetárias usando Série de Fourier
"""
from utils.lib import simulate_and_plot, PLANET_DATA


def main():
    """Interface de linha de comando principal"""
    print("=" * 60)
    print("Simulação de Órbitas Planetárias - Série de Fourier")
    print("=" * 60)
    print()
    
    # Listar planetas disponíveis
    print("Planetas disponíveis:")
    for i, planet in enumerate(PLANET_DATA.keys(), 1):
        data = PLANET_DATA[planet]
        print(f"  {i}. {planet} (excentricidade: {data['ecc']:.4f})")
    print()
    
    # Escolher planeta
    while True:
        try:
            planet_list = list(PLANET_DATA.keys())
            choice = input(f"Escolha um planeta (1-{len(planet_list)}): ").strip()
            planet_idx = int(choice) - 1

            if 0 <= planet_idx < len(planet_list):
                planet_name = planet_list[planet_idx]
                break
            else:
                print(f"!! Erro: Opção inválida! Escolha entre 1 e {len(planet_list)}.")
        except ValueError:
            print("!! Erro: Por favor, digite um número válido.")
        except KeyboardInterrupt:
            print("\n\nAté logo!")
            return
    
    print(f"\nVocê escolheu: {planet_name}")
    print()
    
    # Escolher número de termos
    while True:
        try:
            num_terms = input("Digite o número de termos de Fourier (recomendado: 3-10): ").strip()
            num_terms = int(num_terms)
            
            if num_terms < 1:
                print("!! Erro: O número de termos deve ser pelo menos 1.")
            elif num_terms > 50:
                print("!! Cuidado: Muitos termos podem deixar o gráfico lento.")
                confirm = input("Deseja continuar? (s/n): ").strip().lower()
                if confirm == 's':
                    break
            else:
                break
        except ValueError:
            print("!! Erro: Por favor, digite um número válido.")
        except KeyboardInterrupt:
            print("\n\nAté logo!")
            return
    
    print(f"\nUsando {num_terms} termos na série de Fourier")
    print("\nGerando simulação...")
    
    # Executar simulação
    try:
        simulate_and_plot(planet_name, num_terms)
        print("\nSimulação concluída! Feche a janela do gráfico para sair.")
    except Exception as e:
        print(f"\n!! Erro: ao gerar simulação: {e}")


if __name__ == "__main__":
    main()

