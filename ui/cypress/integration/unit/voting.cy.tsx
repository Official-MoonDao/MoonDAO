import { iterativeNormalization } from '../../../lib/utils/voting'

describe('iterativeNormalization', () => {
  it('should normalize distributions correctly', () => {
      // Source: https://docs.google.com/spreadsheets/d/1oEYeNjJNXQOzP332UO53zo_iWpMmvyEZLXGmgYiJuKE/edit?gid=658868670#gid=658868670
    const testDistributions = [
      {
        // R1
        address: '0x0000000000000000000000000000000000000001',
        distribution: {
          //'1': 0,
          '2': 50,
          '4': 30,
          '3': 20,
          '5': 0,
        },
        id: 1,
        quarter: 2,
        year: 2024,
      },
      {
        // R2
        address: '0x0000000000000000000000000000000000000002',
        distribution: {
          '1': 23,
          '2': 24,
          '4': 49,
          '5': 4,
        },
        id: 2,
        quarter: 2,
        year: 2024,
      },
      {
        //R3
        address: '0x0000000000000000000000000000000000000003',
        distribution: {
          '1': 31,
          '2': 12,
          '4': 42,
          '3': 10,
          '5': 5,
        },
        id: 3,
        quarter: 2,
        year: 2024,
      },
      {
        //R4
        address: '0x0000000000000000000000000000000000000004',
        distribution: {
          '1': 20,
          '2': 20,
          '4': 30,
          '3': 20,
          '5': 10,
        },
        id: 4,
        quarter: 2,
        year: 2024,
      },
      {
        //R5
        address: '0x0000000000000000000000000000000000000005',
        distribution: {
          '1': 30.25,
          '2': 30.25,
          '4': 30.25,
          '3': 9.25,
        },
        id: 5,
        quarter: 2,
        year: 2024,
      },
      {
        //R6
        address: '0x0000000000000000000000000000000000000006',
        distribution: {
          '1': 35,
          '4': 35,
          '3': 20,
          '5': 10,
        },
        id: 6,
        quarter: 2,
        year: 2024,
      },
      {
        //R7
        address: '0x0000000000000000000000000000000000000007',
        distribution: {
          '1': 20.5,
          '2': 22.5,
          '4': 38.5,
          '3': 16.5,
          '5': 2,
        },
        id: 7,
        quarter: 2,
        year: 2024,
      },
      {
        //R8
        address: '0x0000000000000000000000000000000000000008',
        distribution: {
          '1': 48,
          '2': 28,
          '3': 18,
          '5': 6,
        },
        id: 8,
        quarter: 2,
        year: 2024,
      },
    ]

    const projects = [
      { id: '1', title: 'Project 1' },
      { id: '2', title: 'Project 2' },
      { id: '3', title: 'Project 3' },
      { id: '4', title: 'Project 4' },
      { id: '5', title: 'Project 5' },
    ]

    const [normalizedDistributions, votes] = iterativeNormalization(
      testDistributions,
      projects
    )
    const votesGold = [
      [
        25.617465382162504, 37.19126730303909, 14.876506921215638,
        22.314760381823465, 0,
      ],
      [
        19.790022073979447, 20.650457816326366, 13.956425764473845,
        42.16135137499968, 3.441742969387729,
      ],
      [31, 12, 10, 42, 5],
      [20, 20, 20, 30, 10],
      [
        28.85945564992768, 28.85945564992768, 8.824792223531608,
        28.85945564992768, 4.596840826232873,
      ],
      [
        27.00161532655116, 22.852527638146107, 15.429494472314948,
        27.00161532655116, 7.714747236157474,
      ],
      [20.5, 22.5, 16.5, 38.5, 2],
      [
        32.17116462467926, 18.766512697729574, 12.06418673425472,
        32.97674039047171, 4.021395578084907,
      ],
    ]
    expect(votes).to.deep.equal(votesGold)
  })
})

  //const testDistributions = [
    //{
      //// Pablo/R1
      //address: '0x679d87D8640e66778c3419D164998E720D7495f6',
      //distribution: {
        ////'1': 0,
        //'2': 50,
        //'4': 30,
        //'3': 20,
        //'5': 0,
      //},
      //id: 1,
      //quarter: 2,
      //year: 2024,
    //},
    //{
      //// Mitchie/R2
      //address: '0x9fDf876a50EA8f95017dCFC7709356887025B5BB',
      //distribution: {
        //'1': 23,
        //'2': 24,
        //'4': 49,
        //'5': 4,
      //},
      //id: 2,
      //quarter: 2,
      //year: 2024,
    //},
    //{
      ////Phil/R3
      //address: '0x6bFd9e435cF6194c967094959626ddFF4473a836',
      //distribution: {
        //'1': 31,
        //'2': 12,
        //'4': 42,
        //'3': 10,
        //'5': 5,
      //},
      //id: 3,
      //quarter: 2,
      //year: 2024,
    //},
  //]
