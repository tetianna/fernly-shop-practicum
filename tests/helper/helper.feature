Feature: Fernly Helper

  # Oracle: docs/features/fernly-helper.md

  Background:
    Given I am signed in as the first customer from ".env.example"
    And my cart is empty

  Scenario Outline: search_plants shows the catalog with pet-safe filter however it is said
    When I ask the helper "<phrase>"
    Then the helper calls search_plants with petSafe true
    Then the catalog shows only pet-safe plants

    Examples:
      | phrase                                      |
      | show me pet-safe plants                     |
      | I want plants that are safe for pets        |
      | safe for my cat                             |
      | anything safe for dogs?                     |
      | pet-friendly plants please                  |

  Scenario Outline: open_plant opens that plant's page
    When I ask the helper "<phrase>"
    Then the helper calls open_plant with plantId "<plantId>"
    Then I see the page for plant "<plantId>"

    Examples:
      | phrase                         | plantId     |
      | show me the monstera           | pl-monstera |
      | open the snake plant page      | pl-snake    |
      | take me to the hoya carnosa    | pl-hoya     |

  Scenario Outline: add_to_cart adds the plant in the size and quantity the customer said
    When I ask the helper "<phrase>"
    Then the helper calls add_to_cart with plantId "<plantId>", size "<size>" and quantity <quantity>
    Then the cart holds <quantity> of "<plantName>" in size <size>
    Then the cart count in the header shows <quantity> right away

    Examples:
      | phrase                                | plantId     | plantName          | size | quantity |
      | add a monstera deliciosa              | pl-monstera | Monstera Deliciosa | S    | 1        |
      | add 2 snake plants                    | pl-snake    | Snake Plant        | S    | 2        |
      | add two pothos golden                 | pl-pothos   | Pothos 'Golden'    | S    | 2        |
      | a pair of spider plants please        | pl-spider   | Spider Plant       | S    | 2        |
      | add a medium calathea orbifolia       | pl-calathea | Calathea Orbifolia | M    | 1        |
      | add 2 medium monstera deliciosa       | pl-monstera | Monstera Deliciosa | M    | 2        |
      | put a large fiddle leaf fig in my cart| pl-fiddle   | Fiddle Leaf Fig    | L    | 1        |

  Scenario Outline: care_tip answers care questions from the shop's data
    When I ask the helper "<phrase>"
    Then the helper calls care_tip with plantId "<plantId>" and topic "<topic>"
    Then the answer agrees with the shop's data for "<plantId>"

    Examples:
      | phrase                                           | plantId     | topic |
      | is monstera deliciosa safe for my cat?           | pl-monstera | pets  |
      | can dogs be around spider plants?                | pl-spider   | pets  |
      | how much light does the snake plant need?        | pl-snake    | light |
      | what kind of light for fiddle leaf fig?          | pl-fiddle   | light |

  Scenario Outline: the helper never claims an add when the shop refuses for stock
    When I ask the helper "<phrase>"
    Then the helper calls add_to_cart with plantId "<plantId>", size "<size>" and quantity <quantity>
    Then the cart has no "<plantName>"
    Then the cart count in the header shows 0 right away
    Then the helper says the shop refused, and why

    Examples:
      | phrase                          | plantId   | plantName        | size | quantity |
      | add 10 hoya carnosa             | pl-hoya   | Hoya Carnosa     | S    | 10       |
      | put 5 string of pearls in my cart | pl-pearls | String of Pearls | S    | 5        |

  Scenario Outline: the helper says when the shop does not sell a plant and invents no price
    When I ask the helper "<phrase>"
    Then the helper says the shop doesn't sell "<plantName>"
    Then the answer names no price

    Examples:
      | phrase                                    | plantName              |
      | do you sell blue orchids?                 | Blue Orchid            |
      | add a purple venus flytrap                | Purple Venus Flytrap   |
      | is laser fern safe for my dog?            | Laser Fern             |

  Scenario Outline: the same message leads to the right tool and arguments at least nine times out of ten
    When I ask the helper "<phrase>"
    Then the helper picks the correct tool and arguments in at least 9 of 10 tries

    Examples:
      | phrase                   |
      | add a monstera deliciosa |
      | show me pet-safe plants  |
      | open the snake plant     |